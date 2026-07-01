import { useEffect, useState, useCallback } from 'react';
import {
  MessageCircle, RefreshCw, LogOut, CheckCircle2, XCircle, Loader2,
  QrCode, Phone, Send, AlertCircle, Wifi, WifiOff, KeyRound, ServerOff,
} from 'lucide-react';
import {
  getWhatsAppStatus, reconnectWhatsApp, logoutWhatsApp, sendWhatsAppMessage,
  pairWithPhoneNumber, type WhatsAppStatus,
} from '../lib/whatsapp';

const POLL_MS = 3000;

type LinkMethod = 'qr' | 'phone';

export function AdminWhatsAppPanel() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [method, setMethod] = useState<LinkMethod>('qr');

  // Phone pairing form
  const [pairPhone, setPairPhone] = useState('');
  const [pairing, setPairing] = useState(false);

  // Test-send form
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await getWhatsAppStatus();
      setStatus(s);
    } catch (e: any) {
      setStatus({
        qr: null, qrText: null, pairingCode: null, pairingPhone: null,
        connection: 'closed',
        lastError: e?.message ?? 'Cannot reach WhatsApp service. Is server.js running?',
        user: null,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  };

  const handleReconnect = async () => {
    setBusy(true);
    try { await reconnectWhatsApp(); flash(true, 'Reconnecting…'); await refresh(); }
    catch (e: any) { flash(false, e.message); }
    finally { setBusy(false); }
  };

  const handleLogout = async () => {
    if (!confirm('This will unlink the current WhatsApp session and require a fresh link. Continue?')) return;
    setBusy(true);
    try { await logoutWhatsApp(); flash(true, 'Session reset.'); await refresh(); }
    catch (e: any) { flash(false, e.message); }
    finally { setBusy(false); }
  };

  const handlePair = async () => {
    if (!pairPhone.trim()) return;
    setPairing(true);
    try {
      const r = await pairWithPhoneNumber(pairPhone.trim());
      flash(true, r.message ?? 'Pairing code requested.');
      await refresh();
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setPairing(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim() || !testMsg.trim()) return;
    setSending(true);
    try {
      await sendWhatsAppMessage(testPhone.trim(), testMsg.trim());
      flash(true, `Message sent to ${testPhone.trim()}.`);
      setTestMsg('');
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setSending(false);
    }
  };

  const connected = status?.connection === 'open';
  const connecting = status?.connection === 'connecting';
  // Backend unreachable: fetch threw and lastError looks like a network error.
  const offline = !loading && !status?.user && !status?.qr && !status?.pairingCode
    && !!status?.lastError?.toLowerCase().includes('reach');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
          <MessageCircle size={22} className="text-white" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900">WhatsApp Notifications</h2>
          <p className="text-slate-500 text-sm">Link a WhatsApp account to send automated course alerts.</p>
        </div>
      </div>

      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          toast.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {toast.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {toast.text}
        </div>
      )}

      {/* Connection status card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            connected ? 'bg-emerald-100' : connecting ? 'bg-amber-100' : 'bg-rose-100'
          }`}>
            {connected ? <Wifi size={18} className="text-emerald-600" />
              : connecting ? <Loader2 size={18} className="text-amber-600 animate-spin" />
              : <WifiOff size={18} className="text-rose-600" />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-900 text-sm">
              {connected ? 'Connected' : connecting ? 'Connecting…' : 'Disconnected'}
            </p>
            <p className="text-xs text-slate-500">
              {connected && status?.user ? `Linked as ${status.user.name}` : 'Service is not linked to a WhatsApp account.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReconnect}
              disabled={busy || connected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Reconnect
            </button>
            <button
              onClick={handleLogout}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 transition-colors"
            >
              <LogOut size={13} /> Unlink
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="animate-spin text-slate-400" size={28} />
            </div>
          ) : connected ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <p className="font-semibold text-slate-800">WhatsApp is linked and ready</p>
              <p className="text-sm text-slate-500 mt-1">Automated course, quiz, arena, and streak alerts will be delivered automatically.</p>
            </div>
          ) : offline ? (
            /* Backend not running — clear, actionable message. */
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center mb-3">
                <ServerOff size={28} className="text-rose-600" />
              </div>
              <p className="font-semibold text-slate-800">WhatsApp service is not running</p>
              <p className="text-sm text-slate-500 mt-1 max-w-md">
                Start the backend in a terminal: <code className="px-1.5 py-0.5 rounded bg-slate-100 text-emerald-700 text-xs font-mono">cd server && npm install && npm start</code>
              </p>
              <p className="text-xs text-slate-400 mt-2">Once running, the QR code or pairing option will appear here automatically.</p>
              <button
                onClick={refresh}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                <RefreshCw size={15} /> Retry
              </button>
            </div>
          ) : (
            /* Linking methods: QR or phone number. */
            <div className="space-y-4">
              {/* Method tabs */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mx-auto">
                <button
                  onClick={() => setMethod('qr')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    method === 'qr' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <QrCode size={15} /> Scan QR
                </button>
                <button
                  onClick={() => setMethod('phone')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    method === 'phone' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <KeyRound size={15} /> Phone Number
                </button>
              </div>

              {/* QR method */}
              {method === 'qr' && (
                status?.qr ? (
                  <div className="flex flex-col items-center">
                    <div className="p-3 bg-white rounded-2xl border-2 border-emerald-200 shadow-sm">
                      <img src={status.qr} alt="WhatsApp QR code" className="w-56 h-56" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-700 flex items-center gap-1.5">
                      <QrCode size={15} className="text-emerald-600" />
                      WhatsApp → Settings → Linked Devices → Link a device
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Scan this QR code to link the service.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
                      <Loader2 size={28} className="text-amber-600 animate-spin" />
                    </div>
                    <p className="font-semibold text-slate-800">Generating QR code…</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">{status?.lastError ?? 'It will appear here automatically.'}</p>
                  </div>
                )
              )}

              {/* Phone-number pairing method */}
              {method === 'phone' && (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <p className="text-sm text-emerald-800 font-medium leading-relaxed">
                      Enter the phone number registered to your WhatsApp. We'll request an 8-digit code
                      that you type into WhatsApp → <span className="font-semibold">Linked Devices → Link with phone number</span>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Your WhatsApp phone number</label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={pairPhone}
                        onChange={e => setPairPhone(e.target.value)}
                        placeholder="+252611234567"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Include country code. The number must be the one logged into your WhatsApp app.</p>
                  </div>

                  <button
                    onClick={handlePair}
                    disabled={!pairPhone.trim() || pairing}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {pairing ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    Request pairing code
                  </button>

                  {/* Show the code once it arrives */}
                  {status?.pairingCode && (
                    <div className="mt-2 p-4 rounded-xl bg-slate-900 text-center">
                      <p className="text-xs text-slate-400 mb-1">Your pairing code</p>
                      <p className="text-3xl font-bold tracking-[0.3em] text-emerald-400 font-mono">{status.pairingCode}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Open WhatsApp → Linked Devices → Link with phone number → enter this code.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Test send */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Send size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">Send a test message</p>
            <p className="text-xs text-slate-500">Verify delivery to a single number before enabling triggers.</p>
          </div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recipient phone</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+252611234567"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message</label>
            <textarea
              value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
              rows={2}
              placeholder="Hello from Ilesy Academy!"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>
          <button
            onClick={handleSendTest}
            disabled={!connected || sending || !testPhone.trim() || !testMsg.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send test message
          </button>
          {!connected && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertCircle size={13} /> Link WhatsApp above before sending.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
