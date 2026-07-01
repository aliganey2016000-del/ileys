# WhatsApp Notification Service (Baileys)

Automated WhatsApp notifications for Ilesy Academy, powered by
[`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys).

## Why a separate Node.js process?

Baileys keeps a **long-lived WebSocket** to WhatsApp's servers and persists
session credentials to a local `auth_info_baileys/` directory. That rules out
Supabase Edge Functions (Deno, ephemeral, no persistent filesystem), so this
service runs as a standalone Node.js backend. The React frontend talks to it
over HTTP.

## Setup

```bash
cd server
npm install
npm start          # starts the Express API + WhatsApp socket on :3001
```

## Linking methods

**1. QR Code (default)** — on first run the terminal prints a QR code. Open
**WhatsApp → Settings → Linked Devices → Link a device** and scan it.

**2. Phone number pairing** — for when you can't scan a QR (e.g. WhatsApp is
open on the same phone). In the admin panel switch to the **Phone Number**
tab, enter the number registered to your WhatsApp, and click *Request pairing
code*. An 8-digit code is sent to that number's WhatsApp app; enter it in
**WhatsApp → Linked Devices → Link with phone number**.

```bash
# Or via API directly:
curl -X POST http://localhost:3001/whatsapp/pair \
  -H 'Content-Type: application/json' \
  -d '{"phoneNumber":"+252611234567"}'
```

The session persists in `auth_info_baileys/`, so you only link once.

## Admin UI

In the app, sign in as an admin and open the **WhatsApp** sidebar item. The
panel polls `/whatsapp/status` every 3s and renders the QR, connection state,
reconnect/unlink buttons, and a test-send form.

## HTTP API

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET  | `/whatsapp/status` | — | `{ connection, qr, user, lastError }` |
| POST | `/whatsapp/reconnect` | — | Force QR reconnect |
| POST | `/whatsapp/pair` | `{ phoneNumber }` | Request a phone pairing code |
| POST | `/whatsapp/logout` | — | Wipe session + new QR |
| POST | `/whatsapp/send` | `{ recipient, message }` | Send to one number |
| POST | `/whatsapp/trigger` | `{ event, ...payload }` | Fire a trigger |

### Trigger events

| `event` | Payload |
|---------|---------|
| `new_course` | `{ studentPhones, courseName }` |
| `new_lesson` | `{ studentPhones, courseName, lessonTitle }` |
| `new_quiz` | `{ studentPhones, courseName, quizTitle }` |
| `arena_starting` | `{ studentPhones, arenaName, startTimeString }` |
| `streak_at_risk` | `{ studentPhone, streakCount }` |
| `streak_broken` | `{ studentPhone, brokenDays }` |

`studentPhones` may be a single string or an array; the service loops and
sends individually.

## Phone formatting

`formatJid()` strips `+`, `00`, and non-digits, then appends
`@s.whatsapp.net`:

```
"+252611234567"   -> "252611234567@s.whatsapp.net"
"00 252 61 12 34" -> "252611234@s.whatsapp.net"
```

## Frontend usage

```ts
import { triggerNewLesson } from '../lib/whatsapp';
await triggerNewLesson(['+252611234567'], 'Spanish A1', 'Greetings');
```

Set `VITE_WHATSAPP_API_URL` in `.env` if the backend runs somewhere other than
`http://localhost:3001`.

## Wiring triggers from the database

Call the trigger helpers from wherever platform events happen (lesson
publish, quiz publish, arena start, streak cron). For server-side automation
without a browser, POST to `/whatsapp/trigger` directly.
