# WhatsApp Notify Bot

[中文说明](README-ZH.md)

A lightweight Node.js bot that sends scheduled WhatsApp messages to groups or individuals using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js). Events are defined in a simple JSON file — no restart needed to pick up changes.

## Features

- Schedule messages with standard cron expressions
- Send to multiple groups or individuals per event
- Alias-based recipient addressing (no hardcoded IDs in events)
- `@mention` support with automatic handle injection
- Multi-message events (different messages to different recipients in one event)
- Export your WhatsApp group directory to a JSON file for easy alias setup
- Hot-reload: `events.json` is re-read on every tick

## Requirements

- Node.js 18+
- Google Chrome or Chromium installed (whatsapp-web.js uses Puppeteer)
- A WhatsApp account to use as the bot

## Setup

```bash
git clone https://github.com/ketcheon/whatsapp-notify-bot.git
cd whatsapp-notify-bot
npm install
```

### 1. Configure Chrome path

In `index.js`, update the `executablePath` inside `startClient()` to point to your Chrome binary:

```js
executablePath: '/usr/bin/google-chrome-stable', // Linux
// executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
```

### 2. Export your WhatsApp group directory

This step discovers your group IDs and saves them to `whatsapp.json`:

```bash
npm run export:whatsapp
```

Scan the QR code with WhatsApp when prompted. Once authenticated, the bot exports all your groups and exits. Open `whatsapp.json` to find the group IDs you need.

### 3. Configure recipients

Edit `recipients.json` to map friendly aliases to WhatsApp IDs:

```json
{
  "groups": {
    "family_main": "60100000001-0000000000@g.us"
  },
  "people": {
    "alice": "60100000002"
  },
  "lists": {
    "everyone": ["family_main"]
  }
}
```

| Section   | Value format                              | Notes                          |
|-----------|-------------------------------------------|--------------------------------|
| `groups`  | `"<number>@g.us"` or `"<id>@g.us"`       | From `whatsapp.json` export    |
| `people`  | Phone number (digits only, with country code) | Resolved to `<number>@c.us` |
| `lists`   | Array of alias names                      | Can reference groups or people |

### 4. Define events

Edit `events.json`. Changes are picked up automatically on the next cron tick.

#### Simple event (single message)

```json
[
  {
    "name": "Evening reminder",
    "cron": "0 18 * * *",
    "timezone": "Asia/Kuala_Lumpur",
    "message": "Hello! Time for dinner.",
    "recipients": ["family_main"],
    "mentions": ["alice"]
  }
]
```

#### Multi-message event (different messages to different recipients)

```json
[
  {
    "name": "Morning blast",
    "cron": "0 9 * * 1-5",
    "timezone": "Asia/Kuala_Lumpur",
    "messages": [
      {
        "message": "Good morning, main group!",
        "recipients": ["family_main"],
        "mentions": ["alice"]
      },
      {
        "message": "Good morning, alt group!",
        "recipients": ["family_alt"],
        "mentions": ["bob"]
      }
    ]
  }
]
```

#### Event fields

| Field       | Type              | Description                                               |
|-------------|-------------------|-----------------------------------------------------------|
| `name`      | string            | Display name (used in logs)                               |
| `cron`      | string            | 5-field cron expression (`min hour dom mon dow`)          |
| `timezone`  | string            | IANA timezone (e.g. `"Asia/Kuala_Lumpur"`)                |
| `message`   | string            | Message text (single-message style)                       |
| `recipients`| string[]          | Alias names from `recipients.json` (single-message style) |
| `mentions`  | string[]          | People aliases to `@mention` (optional)                   |
| `messages`  | object[]          | Array of `{ message, recipients, mentions }` (multi-style)|

### 5. Run the bot

```bash
npm start
```

On first run, a QR code will be printed in the terminal:

```
Scan this QR code with WhatsApp:
▄▄▄▄▄▄▄ ▄  ▄ ▄▄▄▄▄▄▄
█ ▄▄▄ █ ...
```

Open WhatsApp on your phone → **Linked Devices** → **Link a Device**, then scan the code. Once authenticated, the bot prints `Bot is ready!` and starts the scheduler.

The session is saved locally in `.wwebjs_auth/`, so subsequent starts skip the QR scan entirely.

## Environment variables

| Variable     | Default | Description                        |
|--------------|---------|------------------------------------|
| `DEBUG_LOGS` | `0`     | Set to `1` to enable verbose tick logs |

```bash
DEBUG_LOGS=1 npm start
```

## File reference

| File              | Purpose                                                    |
|-------------------|------------------------------------------------------------|
| `index.js`        | Main bot logic                                             |
| `events.json`     | Scheduled events — edit freely, hot-reloaded each minute   |
| `recipients.json` | Alias book mapping friendly names to WhatsApp IDs          |
| `whatsapp.json`   | Group directory export (generated, not committed)          |
| `.wwebjs_auth/`   | Session data (generated, not committed)                    |

## Notes

- **WhatsApp linked device limit:** WhatsApp allows a maximum of **4 linked devices** per account (your phone counts as the primary, not one of the 4). The bot occupies one of those slots. Your existing linked devices (e.g. WhatsApp Web on your laptop) are unaffected — linking the bot does not disconnect them. If you are already at the 4-device limit, you will need to unlink one before scanning the QR code.
- The cron scheduler runs in the timezone specified per-event; make sure your timezone string is a valid IANA name.
- `whatsapp.json` and `.wwebjs_auth/` are excluded from git via `.gitignore` — they contain your real group IDs and session tokens.
- Keep `recipients.json` private if it contains real phone numbers; consider adding it to `.gitignore` once you've configured it.

## License

MIT
