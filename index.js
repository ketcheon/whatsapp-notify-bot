const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const EVENTS_FILE = path.join(__dirname, 'events.json');
const RECIPIENTS_FILE = path.join(__dirname, 'recipients.json');
const WHATSAPP_FILE = path.join(__dirname, 'whatsapp.json');
const EXPORT_WHATSAPP_MODE = process.argv.includes('--export-whatsapp');
const DEBUG_LOGS = process.env.DEBUG_LOGS === '1';

function debugLog(message) {
    if (DEBUG_LOGS) console.log(message);
}

function clearSession() {
    ['.wwebjs_auth', '.wwebjs_cache'].forEach(dir => {
        const p = path.join(__dirname, dir);
        if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
    });
}

function saveWhatsAppDirectory(payload) {
    fs.writeFileSync(WHATSAPP_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`[export] wrote ${WHATSAPP_FILE}`);
}

async function exportWhatsAppDirectory(client) {
    const chats = await client.getChats();
    const groups = chats
        .filter(chat => chat.isGroup)
        .map(chat => ({
            name: chat.name || chat.formattedTitle || '',
            id: chat.id && chat.id._serialized ? chat.id._serialized : '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    const payload = {
        generatedAt: new Date().toISOString(),
        totalGroups: groups.length,
        groups,
    };

    saveWhatsAppDirectory(payload);
}

function startClient() {
    const client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            executablePath: '/usr/bin/google-chrome-stable',
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
            protocolTimeout: 120000,
        },
    });

    // If not ready within 3 minutes, retry without clearing session
    const watchdog = setTimeout(() => {
        console.log('Startup timed out — retrying...');
        client.destroy().catch(() => {});
        startClient();
    }, 180000);

    client.on('qr', qr => {
        console.log('Scan this QR code with WhatsApp:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        clearTimeout(watchdog);
        console.log('Bot is ready!');

        if (EXPORT_WHATSAPP_MODE) {
            exportWhatsAppDirectory(client)
                .then(() => {
                    console.log('Export complete. You can now map aliases in recipients.json.');
                    return client.destroy();
                })
                .then(() => process.exit(0))
                .catch(err => {
                    console.error('Failed to export whatsapp directory:', err.message);
                    process.exit(1);
                });
            return;
        }

        scheduleEvents(client);
    });

    client.on('auth_failure', () => {
        clearTimeout(watchdog);
        console.log('Auth failed — clearing session and restarting...');
        clearSession();
        startClient();
    });

    client.initialize();
}

function loadEvents() {
    if (!fs.existsSync(EVENTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
}

function loadRecipientBook() {
    if (!fs.existsSync(RECIPIENTS_FILE)) {
        return { groups: {}, people: {}, lists: {} };
    }

    try {
        const book = JSON.parse(fs.readFileSync(RECIPIENTS_FILE, 'utf-8'));
        return {
            groups: book.groups || {},
            people: book.people || {},
            lists: book.lists || {},
        };
    } catch (err) {
        console.error(`[recipients] failed to parse ${RECIPIENTS_FILE}:`, err.message);
        return { groups: {}, people: {}, lists: {} };
    }
}

function normalizePersonId(value) {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value.trim();
    if (!cleaned) return null;
    if (cleaned.endsWith('@c.us')) return cleaned;
    if (cleaned.endsWith('@g.us')) return null;
    return `${cleaned.replace(/\D/g, '')}@c.us`;
}

function normalizeRecipientId(value) {
    if (!value || typeof value !== 'string') return null;
    const cleaned = value.trim();
    if (!cleaned) return null;
    if (cleaned.endsWith('@g.us') || cleaned.endsWith('@c.us')) return cleaned;
    return `${cleaned.replace(/\D/g, '')}@c.us`;
}

function resolveRecipientReferences(references, recipientBook) {
    const results = new Set();
    const refs = Array.isArray(references) ? references : [];
    const expand = ref => {
        if (typeof ref !== 'string') return;
        const token = ref.trim();
        if (!token) return;

        if (token.startsWith('list:')) {
            const listName = token.slice('list:'.length).trim();
            const listItems = recipientBook.lists[listName] || [];
            listItems.forEach(item => expand(item));
            return;
        }

        const fromGroupAlias = recipientBook.groups[token];
        const fromPersonAlias = recipientBook.people[token];
        const resolved = normalizeRecipientId(fromGroupAlias || fromPersonAlias || token);

        if (resolved) results.add(resolved);
    };

    refs.forEach(ref => expand(ref));
    return Array.from(results);
}

function resolveMentionReferences(references, recipientBook) {
    const results = new Set();
    const refs = Array.isArray(references) ? references : [];

    refs.forEach(ref => {
        if (typeof ref !== 'string') return;
        const token = ref.trim();
        if (!token) return;
        const fromAlias = recipientBook.people[token];
        const resolved = normalizePersonId(fromAlias || token);
        if (resolved) results.add(resolved);
    });

    return Array.from(results);
}

async function hydrateMentionContacts(client, mentionIds) {
    const contacts = [];

    for (const id of mentionIds) {
        try {
            const contact = await client.getContactById(id);
            if (contact) contacts.push(contact);
        } catch (err) {
            console.error(`[mentions] unable to resolve ${id}:`, err.message);
        }
    }

    return contacts;
}

function withMentionHandles(message, mentionContacts) {
    let nextMessage = message;

    // WhatsApp needs both mention metadata and the @handle text in the message body.
    mentionContacts.forEach(contact => {
        const handle = `@${contact.id.user}`;
        if (!nextMessage.includes(handle)) {
            nextMessage = `${nextMessage} ${handle}`.trim();
        }
    });

    return nextMessage;
}

async function sendNotification(client, recipient, message, mentions = []) {
    const mentionContacts = await hydrateMentionContacts(client, mentions);
    const finalMessage = withMentionHandles(message, mentionContacts);
    const options = mentionContacts.length ? { mentions: mentionContacts } : {};

    client.sendMessage(recipient, finalMessage, options)
        .then(() => console.log(`Sent to ${recipient}: ${finalMessage}`))
        .catch(err => console.error(`Failed to send to ${recipient}:`, err.message));
}

function normalizeEventMessages(event) {
    if (Array.isArray(event.messages) && event.messages.length) {
        return event.messages
            .filter(item => item && item.message && Array.isArray(item.recipients) && item.recipients.length)
            .map(item => ({
                message: item.message,
                recipients: item.recipients,
                mentions: item.mentions || [],
            }));
    }

    if (event.message && Array.isArray(event.recipients) && event.recipients.length) {
        return [{ message: event.message, recipients: event.recipients, mentions: event.mentions || [] }];
    }

    return [];
}

function scheduleEvents(client) {
    cron.schedule('* * * * *', () => {
        const now = new Date();
        const klTime = now.toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
        debugLog(`[tick] ${klTime}`);

        const events = loadEvents();
        const recipientBook = loadRecipientBook();
        debugLog(`[events] loaded ${events.length} events`);

        events.forEach(event => {
            if (!event.cron) return;

            const parts = event.cron.trim().split(/\s+/);
            if (parts.length !== 5) return;

            const [eMin, eHour, eDom, eMon, eDow] = parts;
            const match = (val, current) => val === '*' || parseInt(val) === current;

            if (
                match(eMin, now.getMinutes()) &&
                match(eHour, now.getHours()) &&
                match(eDom, now.getDate()) &&
                match(eMon, now.getMonth() + 1) &&
                match(eDow, now.getDay())
            ) {
                console.log(`Firing event: ${event.name}`);

                const eventMessages = normalizeEventMessages(event);
                eventMessages.forEach(item => {
                    const recipients = resolveRecipientReferences(item.recipients, recipientBook);
                    const mentions = resolveMentionReferences(item.mentions, recipientBook);

                    recipients.forEach(r => sendNotification(client, r, item.message, mentions));
                });
            }
        });
    }, { timezone: 'Asia/Kuala_Lumpur' });

    console.log('Scheduler running — edit events.json anytime, no restart needed.');
}

startClient();
