import React from 'react';

export function Ludo3DLogo({ className = 'w-64 h-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 96" className={className} role="img" aria-label="Ludo 3D Ultimate Edition">
      <defs>
        <linearGradient id="goldFrame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8c631c" />
        </linearGradient>
      </defs>

      {/* Crown & 4-Quadrant Crest */}
      <g transform="translate(8, 12)">
        <rect x="4" y="14" width="56" height="56" rx="12" fill="#18130e" stroke="url(#goldFrame)" strokeWidth="3" />
        <rect x="11" y="21" width="19" height="19" rx="4" fill="#d9383a" />
        <rect x="34" y="21" width="19" height="19" rx="4" fill="#1e9e5a" />
        <rect x="11" y="44" width="19" height="19" rx="4" fill="#2672d9" />
        <rect x="34" y="44" width="19" height="19" rx="4" fill="#e5a91a" />
        <circle cx="32" cy="42" r="7" fill="#18130e" stroke="#f5efe6" strokeWidth="2" />
        <path d="M22 12 L27 3 L32 10 L37 3 L42 12 Z" fill="url(#goldFrame)" />
      </g>

      {/* Display Typography */}
      <text
        x="78"
        y="53"
        fill="#f5efe6"
        stroke="#0e0c0a"
        strokeWidth="5"
        paintOrder="stroke fill"
        style={{ fontFamily: 'Cinzel, Georgia, serif', fontWeight: 800, fontSize: '40px', letterSpacing: '0.06em' }}
      >
        LUDO
      </text>
      <text
        x="212"
        y="53"
        fill="#e5a91a"
        stroke="#0e0c0a"
        strokeWidth="5"
        paintOrder="stroke fill"
        style={{ fontFamily: 'Cinzel, Georgia, serif', fontWeight: 800, fontSize: '40px', letterSpacing: '0.04em' }}
      >
        3D
      </text>
      <text
        x="80"
        y="76"
        fill="#d4a853"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.26em' }}
      >
        ULTIMATE EDITION
      </text>
    </svg>
  );
}

export function AvatarCrest({ avatar, className = 'w-8 h-8' }: { avatar: string; className?: string }) {
  if (avatar === 'phoenix') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#2b160c" stroke="#f97316" strokeWidth="1.5" />
        <path d="M12 4 C14.5 8 18 9.5 16.5 14.5 C15.2 17.5 12 19.5 12 19.5 C12 19.5 8.8 17.5 7.5 14.5 C6 9.5 9.5 8 12 4 Z" fill="#fb923c" />
        <path d="M12 9 C13 11.5 14.2 12.5 13.5 15 C12.8 16.5 12 17.2 12 17.2 C12 17.2 11.2 16.5 10.5 15 C9.8 12.5 11 11.5 12 9 Z" fill="#fef08a" />
      </svg>
    );
  }
  if (avatar === 'knight') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#0f1b2d" stroke="#60a5fa" strokeWidth="1.5" />
        <path d="M8 18 L9 12 L7 10 L11 6 L15 7 L17 11 L14 13 L16 18 Z" fill="#93c5fd" stroke="#1e3a8a" strokeWidth="1" />
        <circle cx="12.5" cy="9" r="1" fill="#0f172a" />
      </svg>
    );
  }
  if (avatar === 'diamond') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#0c2424" stroke="#2dd4bf" strokeWidth="1.5" />
        <polygon points="12,4 19,10 12,20 5,10" fill="#5eead4" stroke="#0f766e" strokeWidth="1.2" />
        <polygon points="12,4 15,10 12,20 9,10" fill="#ccfbf1" opacity="0.65" />
      </svg>
    );
  }
  // Default crown
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#23190b" stroke="#eab308" strokeWidth="1.5" />
      <path d="M5.5 16.5 L6.5 9 L10 12 L12 7 L14 12 L17.5 9 L18.5 16.5 Z" fill="#facc15" stroke="#854d0e" strokeWidth="1" />
      <rect x="6" y="17" width="12" height="2" rx="1" fill="#d97706" />
    </svg>
  );
}

export function DiceFaceSvg({ value, className = 'w-9 h-9' }: { value: number | null; className?: string }) {
  const pips: Record<number, Array<[number, number]>> = {
    1: [[12, 12]],
    2: [[7, 7], [17, 17]],
    3: [[7, 7], [12, 12], [17, 17]],
    4: [[7, 7], [17, 7], [7, 17], [17, 17]],
    5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
    6: [[7, 6.5], [17, 6.5], [7, 12], [17, 12], [7, 17.5], [17, 17.5]],
  };

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4.5" fill="#f5efe6" stroke="#b48a3e" strokeWidth="1.6" />
      {value && pips[value] ? (
        pips[value].map(([cx, cy], idx) => (
          <circle key={idx} cx={cx} cy={cy} r={value === 1 ? 2.6 : 1.85} fill={value === 1 ? '#b92b27' : '#1c1814'} />
        ))
      ) : (
        <text x="12" y="15.5" textAnchor="middle" fill="#6b5e4d" fontSize="11" fontWeight="800">
          ?
        </text>
      )}
    </svg>
  );
}
