import { useState } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Lightweight inline QR code (pure SVG, no external deps) ──────────────────
function buildQrMatrix(data: string, size = 21): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );

  function drawFinder(r: number, c: number) {
    for (let dr = 0; dr < 7; dr++) {
      for (let dc = 0; dc < 7; dc++) {
        const edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        if (r + dr < size && c + dc < size) matrix[r + dr][c + dc] = edge || inner;
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  const bytes = Array.from(data).map(c => c.charCodeAt(0));
  let bi = 0, bit = 0;
  const reserved = (r: number, c: number) =>
    (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8) ||
    r === 6 || c === 6 || (r === 8 && c <= 8) || (c === 8 && r <= 8);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved(r, c)) {
        const byte = bytes[bi % bytes.length];
        matrix[r][c] = ((byte >> bit) & 1) === 1;
        if (++bit === 8) { bit = 0; bi++; }
      }
    }
  }
  return matrix;
}

function QrCodeSvg({ value, size = 60 }: { value: string; size?: number }) {
  const matrix = buildQrMatrix(value);
  const n = matrix.length;
  const cs = size / n;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges">
      <rect width={size} height={size} fill="white" />
      {matrix.map((row, r) => row.map((on, c) =>
        on ? <rect key={`${r}-${c}`} x={c * cs} y={r * cs} width={cs} height={cs} fill="#0f172a" /> : null
      ))}
    </svg>
  );
}

// ── Premium Seal SVG (embossed, gradient, star) ──────────────────────────────
function GoldSeal({ idSuffix = '' }: { idSuffix?: string } = {}) {
  const sealOuter = `sealOuter${idSuffix}`;
  const sealInner = `sealInner${idSuffix}`;
  const sealShadow = `sealShadow${idSuffix}`;
  const emboss = `emboss${idSuffix}`;
  const ribbonLeft = `ribbonLeft${idSuffix}`;
  const ribbonRight = `ribbonRight${idSuffix}`;
  const certArc = `certArc${idSuffix}`;
  const bottomArc = `bottomArc${idSuffix}`;

  return (
    <svg width="90" height="100" viewBox="0 0 90 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Outer ring gradient */}
        <radialGradient id={sealOuter} cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        {/* Inner face gradient */}
        <radialGradient id={sealInner} cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="50%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde68a" />
        </radialGradient>
        {/* Drop shadow filter */}
        <filter id={sealShadow} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#92400e" floodOpacity="0.35" />
        </filter>
        {/* Emboss filter for inner face */}
        <filter id={emboss}>
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
          <feSpecularLighting in="blur" surfaceScale="4" specularConstant="1.2"
            specularExponent="20" lightingColor="#ffffff" result="specular">
            <fePointLight x="30" y="20" z="60" />
          </feSpecularLighting>
          <feComposite in="specular" in2="SourceAlpha" operator="in" result="clip" />
          <feBlend in="SourceGraphic" in2="clip" mode="screen" />
        </filter>
        {/* Ribbon gradient */}
        <linearGradient id={ribbonLeft} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={ribbonRight} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>

      {/* Ribbon tails */}
      <polygon points="33,74 43,74 40,90 36,83" fill={`url(#${ribbonLeft})`} />
      <polygon points="47,74 57,74 54,83 50,90" fill={`url(#${ribbonRight})`} />

      {/* Outer ring (serrated medal look) */}
      <circle cx="45" cy="45" r="40" fill={`url(#${sealOuter})`} filter={`url(#${sealShadow})`} />

      {/* Decorative notched ring */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const x1 = 45 + 36 * Math.cos(rad);
        const y1 = 45 + 36 * Math.sin(rad);
        const x2 = 45 + 40 * Math.cos(rad);
        const y2 = 45 + 40 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#92400e" strokeWidth="1.5" />;
      })}

      {/* Inner face */}
      <circle cx="45" cy="45" r="32" fill={`url(#${sealInner})`} filter={`url(#${emboss})`} />
      <circle cx="45" cy="45" r="32" fill="none" stroke="#d97706" strokeWidth="1.5" />
      <circle cx="45" cy="45" r="28" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2,2" />

      {/* Star */}
      <path
        d="M45,18 L47.9,27.5 L58,27.5 L49.5,33.5 L52.4,43 L45,37.5 L37.6,43 L40.5,33.5 L32,27.5 L42.1,27.5 Z"
        fill="#b45309"
        stroke="#92400e"
        strokeWidth="0.5"
      />

      {/* CERTIFIED text arc */}
      <path id={certArc} d="M 17,45 A 28,28 0 0,1 73,45" fill="none" />
      <text fontSize="5.5" fontWeight="700" fill="#92400e" letterSpacing="1.5"
        fontFamily="Inter, sans-serif" textAnchor="middle">
        <textPath href={`#${certArc}`} startOffset="50%">CERTIFIED</textPath>
      </text>

      {/* Bottom arc text */}
      <path id={bottomArc} d="M 17,48 A 28,28 0 0,0 73,48" fill="none" />
      <text fontSize="4.5" fontWeight="600" fill="#b45309" letterSpacing="1"
        fontFamily="Inter, sans-serif" textAnchor="middle">
        <textPath href={`#${bottomArc}`} startOffset="50%">ILESY ACADEMY</textPath>
      </text>
    </svg>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────
interface CourseCertificateProps {
  studentName: string;
  courseTitle: string;
  completedAt: string;
  certificateId: string;
  instructorName?: string;
  instructorRole?: string;
  academyDirectorName?: string;
  onClose: () => void;
}

// ── Main Certificate Component ───────────────────────────────────────────────
export function CourseCertificate({
  studentName,
  courseTitle,
  completedAt,
  certificateId,
  instructorName = 'Michael Johnson',
  instructorRole = 'Lead Instructor',
  academyDirectorName = 'Dr. Sarah Mitchell',
  onClose,
}: CourseCertificateProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verificationUrl = `https://ilesyacademy.com/verify/${certificateId}`;

  const formattedDate = new Date(completedAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const handleDownload = async () => {
    const node = document.getElementById('certificate-print');
    if (!node) {
      setError('Could not find certificate element');
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      // Small delay to ensure all styles are applied
      await new Promise(r => setTimeout(r, 100));
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      // A4 landscape in mm: 297 x 210
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 15;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const imgRatio = canvas.width / canvas.height;
      let imgWidth = maxWidth;
      let imgHeight = imgWidth / imgRatio;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight * imgRatio;
      }
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      const filename = `${studentName.replace(/\s+/g, '_')}_Certificate.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="certificate-modal-backdrop fixed inset-0 z-[9999] flex flex-col bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
      {/* Controls — sticky top bar */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 bg-slate-900/60 backdrop-blur-md border-b border-white/10 gap-2">
        <div className="flex flex-col">
          <span className="text-white/60 text-xs font-medium hidden sm:block">
            Click Download to save your certificate as a PDF
          </span>
          {error && (
            <span className="text-rose-400 text-xs font-medium">{error}</span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold rounded-xl hover:bg-slate-50 shadow-lg transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable certificate area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex items-start justify-center py-6 px-4">
        <div id="certificate-print" className="certificate-container relative bg-white w-full max-w-xl mx-auto rounded-lg shadow-2xl overflow-hidden">
          <div className="certificate-card relative bg-white">

            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
              <span className="text-[120px] font-black text-slate-300 tracking-tighter" style={{ opacity: 0.05 }}>LR</span>
            </div>

            {/* Gold border outer */}
            <div className="absolute inset-4 sm:inset-5 border-[3px] border-amber-400/80 pointer-events-none" />
            {/* Gold border inner */}
            <div className="absolute inset-7 sm:inset-8 border border-amber-300/40 pointer-events-none" />

            {/* Corner accents */}
            <div className="absolute top-4 left-4 sm:top-5 sm:left-5 w-8 h-8 sm:w-11 sm:h-11 border-t-[3px] border-l-[3px] border-amber-500" />
            <div className="absolute top-4 right-4 sm:top-5 sm:right-5 w-8 h-8 sm:w-11 sm:h-11 border-t-[3px] border-r-[3px] border-amber-500" />
            <div className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5 w-8 h-8 sm:w-11 sm:h-11 border-b-[3px] border-l-[3px] border-amber-500" />
            <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 w-8 h-8 sm:w-11 sm:h-11 border-b-[3px] border-r-[3px] border-amber-500" />

            {/* Content */}
            <div className="relative py-8 sm:py-10 px-8 sm:px-14">

              {/* Logo */}
              <div className="flex items-center justify-center gap-2.5 mb-4">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md">
                  <span className="text-white font-extrabold text-base sm:text-lg tracking-tight">IA</span>
                </div>
                <span className="font-bold text-xl sm:text-2xl text-slate-800 tracking-tight">Ilesy Academy</span>
              </div>

              {/* Certificate of Completion */}
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] sm:tracking-[0.3em] text-amber-600 font-bold text-center mb-4 sm:mb-5 mt-3 sm:mt-4">
                Certificate of Completion
              </p>

              {/* This is to certify that */}
              <h1 className="text-sm sm:text-base font-medium text-slate-500 text-center mb-2.5 sm:mb-3">
                This is to certify that
              </h1>

              {/* Student name */}
              <h2 className="font-display text-2xl sm:text-3xl text-blue-800 text-center mb-2.5 sm:mb-3 px-2 italic break-words">
                {studentName}
              </h2>

              {/* Decorative divider */}
              <div className="flex items-center justify-center gap-3 mb-2.5 sm:mb-3">
                <div className="w-10 sm:w-14 h-[1px] bg-gradient-to-r from-transparent to-blue-400" />
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <div className="w-10 sm:w-14 h-[1px] bg-gradient-to-l from-transparent to-blue-400" />
              </div>

              {/* Completion text */}
              <p className="text-xs sm:text-sm text-slate-500 text-center mb-1.5 sm:mb-2">
                has successfully completed
              </p>

              {/* Course title */}
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 text-center mb-3 sm:mb-4 px-2 break-words">
                {courseTitle}
              </h3>

              {/* Gold seal */}
              <div className="flex justify-center mb-3 sm:mb-4 mt-1">
                <GoldSeal idSuffix={`-${certificateId || 'default'}`} />
              </div>

              {/* Signatures */}
              <div className="flex items-start justify-center gap-6 sm:gap-16 mb-4 mt-2">

                {/* Instructor */}
                <div className="flex flex-col items-center">
                  <svg viewBox="0 0 140 44" className="w-28 sm:w-36 h-9 sm:h-11 mb-1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6,34 C10,22 16,16 24,20 C28,22 30,28 34,24 C38,20 40,12 46,14 C50,16 50,26 56,22 C62,18 64,8 72,12 C76,14 76,24 82,22 C88,20 92,12 100,14 C106,16 108,26 114,24 C118,22 120,16 128,18"
                      fill="none" stroke="#1e3a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M22,38 C32,36 46,35 60,36 C74,37 88,36 102,34"
                      fill="none" stroke="#1e3a8a" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
                    <path d="M8,28 C12,20 18,18 22,22" fill="none" stroke="#1e3a8a" strokeWidth="2.2" strokeLinecap="round"/>
                    <path d="M60,18 C64,14 68,12 70,16 C72,20 70,26 74,22" fill="none" stroke="#1e3a8a" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <div className="w-24 sm:w-32 h-[1px] bg-slate-300 mb-1.5" />
                  <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Instructor</p>
                  <p className="text-[10px] sm:text-xs text-slate-800 font-semibold mt-0.5 text-center">{instructorName}</p>
                  <p className="text-[8px] sm:text-[9px] text-slate-500 mt-0.5 text-center">{instructorRole}</p>
                </div>

                {/* Academy Director */}
                <div className="flex flex-col items-center">
                  <svg viewBox="0 0 140 44" className="w-28 sm:w-36 h-9 sm:h-11 mb-1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8,30 C14,16 22,10 30,16 C36,20 36,30 42,26 C48,22 50,10 58,12 C64,14 64,26 70,24 C76,22 80,12 88,14 C94,16 96,28 102,26 C108,24 112,14 120,16 C126,18 130,24 134,22"
                      fill="none" stroke="#1e3a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M10,36 C26,33 46,32 64,34 C82,36 98,34 120,32"
                      fill="none" stroke="#1e3a8a" strokeWidth="1" strokeLinecap="round" opacity="0.35"/>
                    <path d="M8,22 C12,14 18,10 24,14 C28,18 26,26 30,22" fill="none" stroke="#1e3a8a" strokeWidth="2.2" strokeLinecap="round"/>
                    <path d="M88,20 C92,12 96,8 100,12" fill="none" stroke="#1e3a8a" strokeWidth="1.6" strokeLinecap="round"/>
                    <path d="M118,18 C122,14 126,12 130,16 C132,18 132,22 130,24" fill="none" stroke="#1e3a8a" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  <div className="w-24 sm:w-32 h-[1px] bg-slate-300 mb-1.5" />
                  <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-wide font-semibold">Academy Director</p>
                  <p className="text-[10px] sm:text-xs text-slate-800 font-semibold mt-0.5 text-center">{academyDirectorName}</p>
                  <p className="text-[8px] sm:text-[9px] text-slate-500 mt-0.5 text-center">Academy Director</p>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="flex items-end justify-between w-full pt-3 sm:pt-4 border-t border-slate-200 gap-2">

                {/* Issue Date */}
                <div className="text-left min-w-0">
                  <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">Issue Date</p>
                  <p className="text-[10px] sm:text-xs font-semibold text-slate-700">{formattedDate}</p>
                </div>

                {/* Certificate ID */}
                <div className="text-center min-w-0 flex-1 px-2">
                  <p className="text-[8px] sm:text-[9px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">Certificate ID</p>
                  <p className="text-[10px] sm:text-xs font-mono font-bold text-blue-700 break-all">
                    {certificateId || 'LR-' + new Date(completedAt).getFullYear() + '-000001'}
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="border border-slate-200 rounded-md p-1 bg-white shadow-sm">
                    <QrCodeSvg value={verificationUrl} size={44} />
                  </div>
                  <p className="text-[8px] sm:text-[9px] text-slate-400 mt-1">Scan to Verify</p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Preview Card (student dashboard) ────────────────────────────────────────
export function CertificatePreviewCard({
  studentName,
  courseTitle,
  completedAt,
  certificateId,
  onView,
}: {
  studentName: string;
  courseTitle: string;
  completedAt: string;
  certificateId: string;
  onView: () => void;
}) {
  return (
    <div className="relative bg-gradient-to-br from-blue-50 to-amber-50 rounded-2xl overflow-hidden shadow-sm border border-amber-200 p-4">
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-amber-300/20 rounded-full blur-xl" />
      <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-blue-300/20 rounded-full blur-xl" />
      <div className="absolute inset-2 border-2 border-amber-300/40 rounded-xl pointer-events-none" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <span className="text-white font-bold text-xs">LR</span>
            </div>
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Certificate Earned
            </span>
          </div>
          <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{courseTitle}</h4>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5">
            <span>
              {new Date(completedAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
            <span className="font-mono text-blue-600 font-semibold">{certificateId}</span>
          </div>
        </div>
        <button
          onClick={onView}
          className="flex-shrink-0 px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-sm transition-all"
        >
          View
        </button>
      </div>
    </div>
  );
}
