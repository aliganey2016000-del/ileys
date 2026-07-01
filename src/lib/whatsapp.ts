/**
 * Frontend client for the WhatsApp Notification Service.
 *
 * Talks to the standalone Node.js backend (server/server.js) which keeps a
 * persistent Baileys WhatsApp socket. The backend URL is configured via the
 * VITE_WHATSAPP_API_URL env var (defaults to http://localhost:3001).
 *
 * Mirrors the shape of src/lib/sms.ts so callers can swap channels easily.
 */

const WHATSAPP_API = (import.meta.env.VITE_WHATSAPP_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:3001';

export interface WhatsAppStatus {
  qr: string | null;
  qrText: string | null;
  pairingCode: string | null;
  pairingPhone: string | null;
  connection: 'open' | 'connecting' | 'closed';
  lastError: string | null;
  user: { id: string; name: string } | null;
}

export interface SendResult {
  phone: string;
  ok: boolean;
  error?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WHATSAPP_API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error ?? `WhatsApp API ${res.status}`);
  return data as T;
}

export function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  return api<WhatsAppStatus>('/whatsapp/status');
}

export function reconnectWhatsApp() {
  return api<{ ok: boolean; message: string }>('/whatsapp/reconnect', { method: 'POST' });
}

/** Request a phone-number pairing code (alternative to QR scanning). */
export function pairWithPhoneNumber(phoneNumber: string) {
  return api<{ ok: boolean; pairingCode: string | null; message: string }>('/whatsapp/pair', {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
}

export function logoutWhatsApp() {
  return api<{ ok: boolean; message: string }>('/whatsapp/logout', { method: 'POST' });
}

export function sendWhatsAppMessage(recipient: string, message: string) {
  return api<{ ok: boolean }>('/whatsapp/send', {
    method: 'POST',
    body: JSON.stringify({ recipient, message }),
  });
}

function trigger(event: string, payload: Record<string, unknown>) {
  return api<{ ok: boolean; results: SendResult[] }>('/whatsapp/trigger', {
    method: 'POST',
    body: JSON.stringify({ event, ...payload }),
  });
}

// ── Per-event WhatsApp helpers (mirror src/lib/sms.ts) ───────────────────────

export function triggerNewCourse(studentPhones: string | string[], courseName: string) {
  return trigger('new_course', { studentPhones, courseName });
}

export function triggerNewLesson(studentPhones: string | string[], courseName: string, lessonTitle: string) {
  return trigger('new_lesson', { studentPhones, courseName, lessonTitle });
}

export function triggerNewQuiz(studentPhones: string | string[], courseName: string, quizTitle: string) {
  return trigger('new_quiz', { studentPhones, courseName, quizTitle });
}

export function triggerLiveArenaStarting(studentPhones: string | string[], arenaName: string, startTimeString: string) {
  return trigger('arena_starting', { studentPhones, arenaName, startTimeString });
}

export function triggerStreakAtRisk(studentPhone: string, streakCount: number) {
  return trigger('streak_at_risk', { studentPhone, streakCount });
}

export function triggerStreakBroken(studentPhone: string, brokenDays: number) {
  return trigger('streak_broken', { studentPhone, brokenDays });
}
