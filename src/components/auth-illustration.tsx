export function AuthIllustration() {
  return (
    <svg viewBox="0 0 480 560" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.14" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bldgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.22" />
          <stop offset="100%" stopColor="white" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      <circle cx="240" cy="230" r="210" fill="url(#skyGrad)" />

      {/* Background building */}
      <rect x="70" y="230" width="120" height="260" rx="6" fill="white" fillOpacity="0.1" />
      {Array.from({ length: 5 }).map((_, row) =>
        Array.from({ length: 3 }).map((_, col) => (
          <rect
            key={`bg-${row}-${col}`}
            x={88 + col * 32}
            y={252 + row * 42}
            width="18"
            height="24"
            rx="2"
            fill="white"
            fillOpacity="0.22"
          />
        ))
      )}

      {/* Main apartment building */}
      <rect x="210" y="140" width="200" height="350" rx="8" fill="url(#bldgGrad)" stroke="white" strokeOpacity="0.35" />
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) => (
          <rect
            key={`main-${row}-${col}`}
            x={230 + col * 42}
            y={165 + row * 44}
            width="26"
            height="30"
            rx="3"
            fill="white"
            fillOpacity={(row + col) % 3 === 0 ? 0.55 : 0.28}
          />
        ))
      )}
      <rect x="285" y="440" width="50" height="50" rx="4" fill="white" fillOpacity="0.4" />

      {/* Ground line */}
      <rect x="40" y="488" width="400" height="6" rx="3" fill="white" fillOpacity="0.25" />

      {/* Shield badge */}
      <g transform="translate(300, 300)">
        <path
          d="M70 0 L136 24 V78 C136 122 108 154 70 172 C32 154 4 122 4 78 V24 Z"
          fill="white"
        />
        <path
          d="M70 0 L136 24 V78 C136 122 108 154 70 172 C32 154 4 122 4 78 V24 Z"
          fill="none"
          stroke="white"
          strokeOpacity="0.5"
          strokeWidth="10"
        />
        <path
          d="M40 86 L62 108 L102 58"
          stroke="oklch(0.42 0.18 262)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* Floating checklist card */}
      <g transform="translate(30, 90)">
        <rect width="118" height="86" rx="12" fill="white" />
        <rect x="16" y="18" width="70" height="8" rx="4" fill="oklch(0.42 0.18 262)" fillOpacity="0.35" />
        <rect x="16" y="36" width="86" height="6" rx="3" fill="oklch(0.42 0.18 262)" fillOpacity="0.18" />
        <rect x="16" y="50" width="86" height="6" rx="3" fill="oklch(0.42 0.18 262)" fillOpacity="0.18" />
        <rect x="16" y="64" width="52" height="6" rx="3" fill="oklch(0.42 0.18 262)" fillOpacity="0.18" />
        <circle cx="98" cy="67" r="10" fill="oklch(0.42 0.18 262)" />
        <path d="M93 67 L97 71 L104 63" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* Decorative dots */}
      <circle cx="420" cy="120" r="5" fill="white" fillOpacity="0.5" />
      <circle cx="440" cy="160" r="3" fill="white" fillOpacity="0.4" />
      <circle cx="60" cy="60" r="4" fill="white" fillOpacity="0.4" />
      <circle cx="400" cy="480" r="5" fill="white" fillOpacity="0.35" />
    </svg>
  );
}
