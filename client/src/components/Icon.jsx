const paths = {
  home: <path d="M4 11.5L12 4l8 7.5M6 10v9a1 1 0 001 1h4v-6h2v6h4a1 1 0 001-1v-9" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  bell: <path d="M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM9.5 19a2.5 2.5 0 005 0" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5.5-5.5-4 4-2-2L3 18" />
    </>
  ),
  close: <path d="M5 5l14 14M19 5L5 19" />,
  heart: <path d="M12 20s-7-4.35-9.5-8.5C.5 8 2 4.5 5.5 4c2-.3 3.7.8 4.5 2.2C10.8 4.8 12.5 3.7 14.5 4c3.5.5 5 4 3 7.5C19 15.65 12 20 12 20z" />,
  comment: <path d="M4 4h16v12H8l-4 4V4z" />,
  repost: <path d="M7 7h10v4M17 17H7v-4M4 7l3-3 3 3M20 17l-3 3-3-3" />,
  flag: <path d="M5 3v18M5 4h13l-3 4 3 4H5" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </>
  ),
  logout: <path d="M9 4H5v16h4M15 8l4 4-4 4M19 12H9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M4 12l5 5L20 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 00-.15-1.45l2-1.55-2-3.46-2.35.9a7 7 0 00-2.5-1.45L13.5 2h-3l-.5 2.99a7 7 0 00-2.5 1.45l-2.35-.9-2 3.46 2 1.55A7 7 0 005 12c0 .49.05.97.15 1.45l-2 1.55 2 3.46 2.35-.9c.73.62 1.58 1.11 2.5 1.45L10.5 22h3l.5-2.99a7 7 0 002.5-1.45l2.35.9 2-3.46-2-1.55c.1-.48.15-.96.15-1.45z" />
    </>
  ),
  scam: (
    <>
      <path d="M12 2L2 21h20L12 2z" />
      <path d="M12 9v5M12 17.5h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.9 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a13.7 13.7 0 01-3.1 3.9M6.5 6.5C4 8.1 2 12 2 12s1.4 2.9 4 4.7A10.6 10.6 0 0012 19c1.1 0 2.1-.15 3-.43" />
      <path d="M9.5 14.5a3 3 0 004.2-4.2" />
      <path d="M3 3l18 18" />
    </>
  ),
};

export default function Icon({ name, size = 22, strokeWidth = 1.8, filled = false, style, className }) {
  const content = paths[name];
  if (!content) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
}
