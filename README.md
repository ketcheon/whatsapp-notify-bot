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

- Schedule messages with standard cron expressions
  > 使用标准 cron 表达式定时发送消息
- Send to multiple groups or individuals per event
  > 每个事件可发送给多个群组或个人
- Alias-based recipient addressing (no hardcoded IDs in events)
  > 使用别名引用收件人，事件配置中无需硬编码 ID
- `@mention` support with automatic handle injection
  > 支持 `@提及`，自动注入 @handle 文字
- Multi-message events (different messages to different recipients in one event)
  > 多消息事件：同一事件可向不同收件人发送不同内容
- Export your WhatsApp group directory to a JSON file for easy alias setup
  > 导出 WhatsApp 群组目录到 JSON，方便配置别名
- Hot-reload: `events.json` is re-read on every tick
  > 热重载：每分钟自动读取最新的 `events.json`

## Requirements 环境要求

- Node.js 18+
- Google Chrome or Chromium installed (whatsapp-web.js uses Puppeteer)
  > 需安装 Google Chrome 或 Chromium（whatsapp-web.js 依赖 Puppeteer）
- A WhatsApp account to use as the bot
  > 需要一个 WhatsApp 账号作为机器人

## Setup 安装配置

```bash
git clone https://github.com/ketcheon/whatsapp-notify-bot.git
cd whatsapp-notify-bot
npm install
```

### 1. Configure Chrome path 配置 Chrome 路径

In `index.js`, update the `executablePath` inside `startClient()` to point to your Chrome binary:
> 在 `index.js` 中，将 `startClient()` 里的 `executablePath` 改为你的 Chrome 可执行文件路径：

```js
executablePath: '/usr/bin/google-chrome-stable', // Linux
// executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
```

### 2. Export your WhatsApp group directory 导出 WhatsApp 群组目录

This step discovers your group IDs and saves them to `whatsapp.json`:
> 此步骤会发现你的群组 ID 并保存到 `whatsapp.json`：

```bash
npm run export:whatsapp
```

Scan the QR code with WhatsApp when prompted. Once authenticated, the bot exports all your groups and exits. Open `whatsapp.json` to find the group IDs you need.
> 按提示用 WhatsApp 扫描二维码。认证成功后，机器人会导出所有群组并退出。打开 `whatsapp.json` 查找所需的群组 ID。

### 3. Configure recipients 配置收件人

Edit `recipients.json` to map friendly aliases to WhatsApp IDs:
> 编辑 `recipients.json`，将友好别名映射到 WhatsApp ID：

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

| Section 字段  | Value format 格式                              | Notes 说明                          |
|---------------|------------------------------------------------|-------------------------------------|
| `groups`      | `"<number>@g.us"` or `"<id>@g.us"`            | From `whatsapp.json` export / 来自导出文件 |
| `people`      | Phone number (digits only, with country code) / 纯数字手机号（含国家码） | Resolved to `<number>@c.us` |
| `lists`       | Array of alias names / 别名数组                | Can reference groups or people / 可引用群组或个人 |

### 4. Define events 定义事件

Edit `events.json`. Changes are picked up automatically on the next cron tick.
> 编辑 `events.json`，下一个 cron 周期自动生效，无需重启。

#### Simple event (single message) 简单事件（单条消息）

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

#### Multi-message event (different messages to different recipients) 多消息事件

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

#### Event fields 事件字段说明

| Field 字段   | Type 类型         | Description 说明                                          |
|-------------|-------------------|-----------------------------------------------------------|
| `name`      | string            | Display name (used in logs) / 显示名称（用于日志）         |
| `cron`      | string            | 5-field cron expression (`min hour dom mon dow`) / 5段 cron 表达式 |
| `timezone`  | string            | IANA timezone (e.g. `"Asia/Kuala_Lumpur"`) / IANA 时区名  |
| `message`   | string            | Message text (single-message style) / 消息内容（单消息模式）|
| `recipients`| string[]          | Alias names from `recipients.json` / 来自 `recipients.json` 的别名 |
| `mentions`  | string[]          | People aliases to `@mention` (optional) / 要 @提及 的人（可选）|
| `messages`  | object[]          | Array of `{ message, recipients, mentions }` (multi-style) / 多消息数组 |

### 5. Run the bot 启动机器人

```bash
npm start
```

On first run, a QR code will be printed in the terminal:
> 首次运行时，终端会打印一个二维码：

```
Scan this QR code with WhatsApp:
▄▄▄▄▄▄▄ ▄  ▄ ▄▄▄▄▄▄▄
█ ▄▄▄ █ ...
```

Open WhatsApp on your phone → **Linked Devices** → **Link a Device**, then scan the code. Once authenticated, the bot prints `Bot is ready!` and starts the scheduler.
> 打开手机 WhatsApp → **已关联设备** → **关联设备**，扫描二维码。认证成功后，机器人会打印 `Bot is ready!` 并启动调度器。

The session is saved locally in `.wwebjs_auth/`, so subsequent starts skip the QR scan entirely.
> 会话保存在本地 `.wwebjs_auth/` 目录中，后续启动无需再次扫码。

## Environment variables 环境变量

| Variable 变量 | Default 默认 | Description 说明                        |
|---------------|-------------|-----------------------------------------|
| `DEBUG_LOGS`  | `0`         | Set to `1` to enable verbose tick logs / 设为 `1` 开启详细日志 |

```bash
DEBUG_LOGS=1 npm start
```

## File reference 文件说明

| File 文件          | Purpose 用途                                                |
|--------------------|-------------------------------------------------------------|
| `index.js`         | Main bot logic / 主逻辑                                     |
| `events.json`      | Scheduled events — edit freely, hot-reloaded each minute / 定时事件，热重载 |
| `recipients.json`  | Alias book mapping friendly names to WhatsApp IDs / 别名与 ID 映射表 |
| `whatsapp.json`    | Group directory export (generated, not committed) / 群组目录导出（自动生成，不提交） |
| `.wwebjs_auth/`    | Session data (generated, not committed) / 会话数据（自动生成，不提交） |

## Notes 备注

- The cron scheduler runs in the timezone specified per-event; make sure your timezone string is a valid IANA name.
  > cron 调度器使用每个事件指定的时区，请确保时区字符串是有效的 IANA 名称。
- `whatsapp.json` and `.wwebjs_auth/` are excluded from git via `.gitignore` — they contain your real group IDs and session tokens.
  > `whatsapp.json` 和 `.wwebjs_auth/` 已通过 `.gitignore` 排除，其中包含真实的群组 ID 和会话令牌。
- Keep `recipients.json` private if it contains real phone numbers; consider adding it to `.gitignore` once you've configured it.
  > 如果 `recipients.json` 包含真实手机号，请注意保密，配置完成后可将其加入 `.gitignore`。

## License

MIT
