// @ts-check
/**
 * Express HTTP API — WhatsApp Notification Service
 *
 *   GET  /whatsapp/status         -> { connection, qr, pairingCode, pairingPhone, user, lastError }
 *   POST /whatsapp/reconnect      -> force QR reconnect
 *   POST /whatsapp/pair           -> { phoneNumber }  request a phone pairing code
 *   POST /whatsapp/logout         -> wipe session, restart with fresh QR
 *   POST /whatsapp/send           -> { recipient, message }
 *   POST /whatsapp/trigger        -> { event, ...payload }
 *
 * Start:  node server/server.js
 */

import express from 'express';
import cors from 'cors';
import {
  initWhatsApp,
  getConnectionState,
  reconnect,
  logout,
  requestPhonePairing,
  sendWhatsAppMessage,
  triggerNewCourse,
  triggerNewLesson,
  triggerNewQuiz,
  triggerLiveArenaStarting,
  triggerStreakAtRisk,
  triggerStreakBroken,
} from './whatsappService.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = Number(process.env.WHATSAPP_API_PORT ?? 3001);

const TRIGGERS = {
  new_course:     triggerNewCourse,
  new_lesson:     triggerNewLesson,
  new_quiz:       triggerNewQuiz,
  arena_starting: triggerLiveArenaStarting,
  streak_at_risk: triggerStreakAtRisk,
  streak_broken:  triggerStreakBroken,
};

const TRIGGER_ARGS = {
  new_course:     p => [p.studentPhones, p.courseName],
  new_lesson:     p => [p.studentPhones, p.courseName, p.lessonTitle],
  new_quiz:       p => [p.studentPhones, p.courseName, p.quizTitle],
  arena_starting: p => [p.studentPhones, p.arenaName, p.startTimeString],
  streak_at_risk: p => [p.studentPhone, p.streakCount],
  streak_broken:  p => [p.studentPhone, p.brokenDays],
};

app.get('/whatsapp/status', (_req, res) => res.json(getConnectionState()));

app.post('/whatsapp/reconnect', async (_req, res) => {
  try { res.json(await reconnect()); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// Phone-number pairing: body = { phoneNumber: "+252XXXXXXXXX" }
app.post('/whatsapp/pair', async (req, res) => {
  const { phoneNumber } = req.body ?? {};
  if (!phoneNumber) return res.status(400).json({ ok: false, error: 'phoneNumber is required' });
  try {
    const result = await requestPhonePairing(phoneNumber);
    // The code might not be ready yet; client should poll /status for pairingCode.
    res.json(result);
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

app.post('/whatsapp/logout', async (_req, res) => {
  try { res.json(await logout()); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/whatsapp/send', async (req, res) => {
  const { recipient, message } = req.body ?? {};
  if (!recipient || !message) return res.status(400).json({ ok: false, error: 'recipient and message are required' });
  try { await sendWhatsAppMessage(recipient, message); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ ok: false, error: e.message }); }
});

app.post('/whatsapp/trigger', async (req, res) => {
  const { event, ...payload } = req.body ?? {};
  const handler = TRIGGERS[event];
  const argBuilder = TRIGGER_ARGS[event];
  if (!handler || !argBuilder) return res.status(400).json({ ok: false, error: `Unknown event: ${event}` });
  try { res.json({ ok: true, results: await handler(...argBuilder(payload)) }); }
  catch (e) { res.status(502).json({ ok: false, error: e.message }); }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

initWhatsApp().catch(e => console.error('[WhatsApp] init failed:', e));

app.listen(PORT, () => {
  console.log(`[WhatsApp] API → http://localhost:${PORT}`);
  console.log('[WhatsApp] Admin panel polls /whatsapp/status every 3s for the QR / pairing code.');
});
