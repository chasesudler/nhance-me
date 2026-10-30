export default function Logo() {
  return (
    <div className="brand" role="img" aria-label="Nhance Me">
      <svg className="brand-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="nhance-n-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8B5CF6" />
            <stop offset=".55" stopColor="#D946EF" />
            <stop offset="1" stopColor="#EC4899" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="13" fill="url(#nhance-n-grad)" />
        <path d="M15 33V15l18 18V15" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M37.5 5.5l1.15 3 3 1.15-3 1.15-1.15 3-1.15-3-3-1.15 3-1.15z" fill="#FDE68A" />
      </svg>
      <span className="brand-name">
        Nhance <span className="brand-name-accent">Me</span>
      </span>
    </div>
  );
}
