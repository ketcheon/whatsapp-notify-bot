# WhatsApp 定时通知机器人

[English](README.md)

一个轻量 Node.js 机器人，使用 [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) 向群组或个人发送定时 WhatsApp 消息。事件通过 JSON 文件配置，无需重启即可生效。

## 功能特性

- 使用标准 cron 表达式定时发送消息
- 每个事件可发送给多个群组或个人
- 使用别名引用收件人，事件配置中无需硬编码 ID
- 支持 `@提及`，自动注入 @handle 文字
- 多消息事件：同一事件可向不同收件人发送不同内容
- 导出 WhatsApp 群组目录到 JSON，方便配置别名
- 热重载：每分钟自动读取最新的 `events.json`，无需重启

## 环境要求

- Node.js 18+
- 已安装 Google Chrome 或 Chromium（whatsapp-web.js 依赖 Puppeteer）
- 一个用作机器人的 WhatsApp 账号

## 安装配置

```bash
git clone https://github.com/ketcheon/whatsapp-notify-bot.git
cd whatsapp-notify-bot
npm install
```

### 1. 配置 Chrome 路径

在 `index.js` 中，将 `startClient()` 里的 `executablePath` 改为你的 Chrome 可执行文件路径：

```js
executablePath: '/usr/bin/google-chrome-stable', // Linux
// executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
```

### 2. 导出 WhatsApp 群组目录

此步骤会发现你的群组 ID 并保存到 `whatsapp.json`：

```bash
npm run export:whatsapp
```

按提示用 WhatsApp 扫描二维码。认证成功后，机器人会导出所有群组并退出。生成的 `whatsapp.json` 格式如下：

```json
{
  "generatedAt": "2026-08-01T10:00:00.000Z",
  "totalGroups": 3,
  "groups": [
    { "name": "Family Chat",       "id": "60100000001-1234567890@g.us" },
    { "name": "Office Team",        "id": "120363000000000001@g.us" },
    { "name": "Weekend Hikers",     "id": "120363000000000002@g.us" }
  ]
}
```

将需要的 `id` 值复制到 `recipients.json` 中并设置别名（见第 3 步）。

### 3. 配置收件人

编辑 `recipients.json`，将友好别名映射到 WhatsApp ID：

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

| 字段      | 值格式                                    | 说明                                |
|-----------|-------------------------------------------|-------------------------------------|
| `groups`  | `"<number>@g.us"` 或 `"<id>@g.us"`       | 来自 `whatsapp.json` 导出文件        |
| `people`  | 纯数字手机号（含国家码）                   | 自动解析为 `<number>@c.us`           |
| `lists`   | 别名数组                                  | 可引用群组或个人别名                 |

### 4. 定义事件

编辑 `events.json`，下一个 cron 周期自动生效，无需重启。

#### 简单事件（单条消息）

```json
[
  {
    "name": "晚间提醒",
    "cron": "0 18 * * *",
    "timezone": "Asia/Kuala_Lumpur",
    "message": "Hello！该吃饭了。",
    "recipients": ["family_main"],
    "mentions": ["alice"]
  }
]
```

#### 多消息事件（向不同收件人发送不同内容）

```json
[
  {
    "name": "早安群发",
    "cron": "0 9 * * 1-5",
    "timezone": "Asia/Kuala_Lumpur",
    "messages": [
      {
        "message": "主群早安！",
        "recipients": ["family_main"],
        "mentions": ["alice"]
      },
      {
        "message": "副群早安！",
        "recipients": ["family_alt"],
        "mentions": ["bob"]
      }
    ]
  }
]
```

#### 事件字段说明

| 字段         | 类型              | 说明                                                      |
|-------------|-------------------|-----------------------------------------------------------|
| `name`      | string            | 显示名称（用于日志）                                        |
| `cron`      | string            | 5 段 cron 表达式（`分 时 日 月 周`）                        |
| `timezone`  | string            | IANA 时区名（如 `"Asia/Kuala_Lumpur"`）                    |
| `message`   | string            | 消息内容（单消息模式）                                      |
| `recipients`| string[]          | 来自 `recipients.json` 的别名列表（单消息模式）              |
| `mentions`  | string[]          | 要 @提及 的人的别名（可选）                                  |
| `messages`  | object[]          | `{ message, recipients, mentions }` 数组（多消息模式）      |

### 5. 启动机器人

```bash
npm start
```

首次运行时，终端会打印一个二维码：

```
Scan this QR code with WhatsApp:
▄▄▄▄▄▄▄ ▄  ▄ ▄▄▄▄▄▄▄
█ ▄▄▄ █ ...
```

打开手机 WhatsApp → **已关联设备** → **关联设备**，扫描二维码。认证成功后，机器人会打印 `Bot is ready!` 并启动调度器。

会话保存在本地 `.wwebjs_auth/` 目录中，后续启动无需再次扫码。

## 环境变量

| 变量          | 默认值 | 说明                           |
|---------------|--------|-------------------------------|
| `DEBUG_LOGS`  | `0`    | 设为 `1` 开启详细 tick 日志     |

```bash
DEBUG_LOGS=1 npm start
```

## 文件说明

| 文件               | 用途                                                        |
|--------------------|-------------------------------------------------------------|
| `index.js`         | 主逻辑                                                      |
| `events.json`      | 定时事件配置，热重载，随时修改随时生效                         |
| `recipients.json`  | 别名与 WhatsApp ID 映射表                                    |
| `whatsapp.json`    | 群组目录导出文件（自动生成，不提交到 git）                     |
| `.wwebjs_auth/`    | WhatsApp 会话数据（自动生成，不提交到 git）                   |

## 备注

- **WhatsApp 关联设备限制：** WhatsApp 每个账号最多允许关联 **4 台设备**（手机为主设备，不占这 4 个名额）。机器人会占用其中一个名额。已关联的其他设备（如电脑上的 WhatsApp Web）不受影响，关联机器人不会将它们断开。如果你已达到 4 台设备上限，需要先移除一台，再扫描机器人的二维码。
- cron 调度器使用每个事件指定的时区，请确保时区字符串是有效的 IANA 名称。
- `whatsapp.json` 和 `.wwebjs_auth/` 已通过 `.gitignore` 排除，其中包含真实的群组 ID 和会话令牌，请勿提交。
- 如果 `recipients.json` 包含真实手机号，请注意保密，配置完成后可将其加入 `.gitignore`。

## 许可证

MIT
