// @ts-check
/**
 * WhatsApp Notification Service (Baileys)
 * ----------------------------------------
 * Persistent Node.js backend. Supports two linking methods:
 *   1. QR Code  — default; generated automatically on startup.
 *   2. Phone pairing code — call requestPairingCode(phoneNumber) after init
 *      and WhatsApp sends an 8-digit code to that number's app.
 *
 * Run:  node server/server.js
 */

import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, '..', 'auth_info_baileys');

// ── Shared mutable state (polled by Express API) ─────────────────────────────
const state = {
  qr: null,              // base64 data-URL, shown in the admin panel
  qrText: null,          // raw string for terminal display
  pairingCode: null,     // 8-digit code when phone-pairing method is used
  pairingPhone: null,    // the phone number that requested the pairing code
  connection: 'closed',  // 'open' | 'connecting' | 'closed'
  lastError: null,
  user: null,            // { id, name } once authenticated
};

let sock = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// ── Phone number formatting ───────────────────────────────────────────────────

/**
 * Strip leading '+', '00', and non-digit characters, then append
 * '@s.whatsapp.net'. E.g. "+252611234567" → "252611234567@s.whatsapp.net".
 */
export function formatJid(rawNumber) {
  if (typeof rawNumber !== 'string') return null;
  let n = rawNumber.replace(/[^\d]/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (!n) return null;
  return `${n}@s.whatsapp.net`;
}

/** Same cleanup but returns the bare number (no suffix) for Baileys' pairing API. */
function stripToDigits(rawNumber) {
  if (typeof rawNumber !== 'string') return null;
  let n = rawNumber.replace(/[^\d]/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  return n || null;
}

// ── Terminal QR renderer ──────────────────────────────────────────────────────
function printQrToTerminal(qrString) {
  try {
    qrcode.toString(qrString, { type: 'terminal', small: true }, (err, qr) => {
      if (err || !qr) { console.log('\n[WhatsApp] QR string:\n', qrString); return; }
      console.log('\n[WhatsApp] Scan the QR code to link:\n');
      console.log(qr);
    });
  } catch {
    console.log('\n[WhatsApp] QR string:\n', qrString);
  }
}

// ── Connection initialisation ─────────────────────────────────────────────────

/**
 * Initialize the Baileys socket.  Called on startup and after any disconnect.
 *
 * @param {object} [opts]
 * @param {'qr'|'phone'} [opts.method='qr']   Which linking method to use.
 * @param {string}       [opts.phoneNumber]    Required when method='phone'.
 */
export async function initWhatsApp({ method = 'qr', phoneNumber } = {}) {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  // When using phone pairing we must disable the QR entirely.
  const usePairing = method === 'phone' && !!phoneNumber;

  sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: false,
    logger: P({ level: 'silent' }),
    browser: ['Ilesy Academy', 'Chrome', '1.0.0'],
    connectTimeoutMs: 30_000,
    retryRequestDelayMs: 250,
    // Required: tell Baileys not to emit QR when we're using pairing-code flow.
    ...(usePairing ? {} : {}),
  });

  state.connection = 'connecting';
  state.pairingCode = null;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { qr, connection, lastDisconnect } = update;

    // ── QR received (QR method) ───────────────────────────────────────────────
    if (qr && !usePairing) {
      state.qrText = qr;
      state.lastError = null;
      printQrToTerminal(qr);
      try {
        state.qr = await qrcode.toDataURL(qr, { margin: 1, width: 320 });
      } catch {
        state.qr = null;
      }
    }

    // ── Authenticated ─────────────────────────────────────────────────────────
    if (connection === 'open') {
      state.connection = 'open';
      state.qr = null;
      state.qrText = null;
      state.pairingCode = null;
      state.pairingPhone = null;
      state.lastError = null;
      reconnectAttempts = 0;
      try {
        const me = sock.user;
        state.user = me ? { id: me.id, name: me.name || me.id } : null;
      } catch {
        state.user = null;
      }
      console.log('[WhatsApp] Connected as', state.user?.id ?? 'unknown');
    }

    // ── Disconnected ──────────────────────────────────────────────────────────
    if (connection === 'close') {
      state.connection = 'closed';
      state.user = null;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const isLoggedOut = code === DisconnectReason.loggedOut;
      const shouldReconnect = !isLoggedOut && reconnectAttempts < MAX_RECONNECT_ATTEMPTS;

      console.log(`[WhatsApp] Closed (code ${code}). Reconnect: ${shouldReconnect}`);

      if (isLoggedOut) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        state.lastError = 'Logged out — re-link the device.';
      } else {
        state.lastError = `Disconnected (code ${code}).`;
      }

      if (shouldReconnect) {
        reconnectAttempts += 1;
        setTimeout(() => initWhatsApp(), Math.min(2000 * reconnectAttempts, 10_000));
      }
    }
  });

  // ── Phone pairing: request the code once the socket is ready ─────────────
  if (usePairing) {
    const digits = stripToDigits(phoneNumber);
    if (!digits) throw new Error(`Invalid phone number for pairing: "${phoneNumber}"`);

    // Baileys needs a moment before the pairing call is accepted.
    await new Promise(r => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(digits);
      // Format as "XXXX-XXXX" for readability.
      state.pairingCode = code?.match(/.{1,4}/g)?.join('-') ?? code;
      state.pairingPhone = phoneNumber;
      console.log(`[WhatsApp] Pairing code for ${digits}: ${state.pairingCode}`);
      console.log('[WhatsApp] Enter this code in WhatsApp → Linked Devices → Link with phone number.');
    } catch (err) {
      state.lastError = `Pairing code request failed: ${err?.message ?? err}`;
      console.error('[WhatsApp]', state.lastError);
    }
  }

  return sock;
}

// ── Public state / control API ────────────────────────────────────────────────

export function getConnectionState() { return { ...state }; }

export async function reconnect() {
  if (state.connection === 'open') return { ok: true, message: 'Already connected.' };
  reconnectAttempts = 0;
  await initWhatsApp();
  return { ok: true, message: 'Reconnecting…' };
}

export async function logout() {
  try { if (sock) await sock.logout(); } catch { /* ignore */ }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  Object.assign(state, { qr: null, qrText: null, pairingCode: null, pairingPhone: null, connection: 'closed', user: null, lastError: null });
  reconnectAttempts = 0;
  await initWhatsApp();
  return { ok: true, message: 'Logged out. New QR generated.' };
}

/**
 * Request a phone-number pairing code.
 * Tears down any existing socket and restarts with method='phone'.
 */
export async function requestPhonePairing(phoneNumber) {
  // Close existing socket gracefully.
  try { if (sock) sock.end(undefined); } catch { /* ignore */ }
  state.qr = null;
  state.qrText = null;
  state.pairingCode = null;
  state.pairingPhone = null;
  state.connection = 'connecting';
  state.lastError = null;

  await initWhatsApp({ method: 'phone', phoneNumber });
  // The code appears in state.pairingCode once Baileys returns it.
  return {
    ok: true,
    pairingCode: state.pairingCode,
    message: state.pairingCode
      ? `Enter code ${state.pairingCode} in WhatsApp → Linked Devices → Link with phone number.`
      : 'Pairing code request sent. It will appear shortly.',
  };
}

// ── Messaging ─────────────────────────────────────────────────────────────────

export async function sendWhatsAppMessage(recipientNumber, message) {
  if (!sock || state.connection !== 'open') {
    const ok = await waitForConnection(15_000);
    if (!ok) throw new Error('WhatsApp is not connected. Link the device from the admin panel first.');
  }
  const jid = formatJid(recipientNumber);
  if (!jid) throw new Error(`Invalid phone number: "${recipientNumber}"`);
  try {
    return await sock.sendMessage(jid, { text: message });
  } catch (err) {
    console.error(`[WhatsApp] Send failed to ${jid}:`, err?.message ?? err);
    throw err;
  }
}

function waitForConnection(timeoutMs) {
  return new Promise(resolve => {
    if (state.connection === 'open') return resolve(true);
    const deadline = Date.now() + timeoutMs;
    const t = setInterval(() => {
      if (state.connection === 'open') { clearInterval(t); resolve(true); }
      else if (Date.now() >= deadline) { clearInterval(t); resolve(false); }
    }, 500);
  });
}

async function broadcast(studentPhones, message) {
  const phones = (Array.isArray(studentPhones) ? studentPhones : [studentPhones]).filter(Boolean);
  const results = [];
  for (const phone of phones) {
    try { await sendWhatsAppMessage(phone, message); results.push({ phone, ok: true }); }
    catch (err) { results.push({ phone, ok: false, error: err?.message ?? String(err) }); }
  }
  return results;
}

// ── Platform event triggers ───────────────────────────────────────────────────

export const triggerNewCourse = (phones, courseName) =>
  broadcast(phones, `Exciting News! A brand new course '${courseName}' has been added to your dashboard. Log in now to explore the curriculum!`);

export const triggerNewLesson = (phones, courseName, lessonTitle) =>
  broadcast(phones, `New Lesson Alert! '${lessonTitle}' is now live in your course '${courseName}'. Keep up the momentum and check it out!`);

export const triggerNewQuiz = (phones, courseName, quizTitle) =>
  broadcast(phones, `Quiz Available: Test your skills! '${quizTitle}' has been published in '${courseName}'. Good luck!`);

export const triggerLiveArenaStarting = (phones, arenaName, startTimeString) =>
  broadcast(phones, `Live Arena: '${arenaName}' is kicking off soon (${startTimeString})! Don't miss your chance to compete with peers live.`);

export const triggerStreakAtRisk = (phone, streakCount) =>
  broadcast(phone, `Keep it going! Your ${streakCount}-day learning streak is at risk. Spend just 5 minutes completing a lesson tonight to save it!`);

export const triggerStreakBroken = (phone, brokenDays) =>
  broadcast(phone, `Your ${brokenDays}-day streak has reset, but your progress hasn't! Jump back in today and start a fresh streak. Your goals are waiting.`);

// Standalone bootstrap (node whatsappService.js)
if (import.meta.url === `file://${process.argv[1]}`) {
  initWhatsApp().catch(e => console.error('[WhatsApp] init failed:', e));
}
