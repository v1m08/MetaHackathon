// Cute "Muse" profile pictures for the demo accounts: a round little character with a sparkle on top, one color
// scheme per person. Plain SVG data URIs, so they need no network and look sharp at any size.

export type MuseColors = { bg: string; from: string; to: string };

export const MUSE_COLORS: Record<string, MuseColors> = {
  nivan: { bg: "#E6EDFF", from: "#6C8CFF", to: "#9B6CFF" },
  armaan: { bg: "#FFF0E6", from: "#FF9A62", to: "#FF5E7E" },
  vedansh: { bg: "#E4FAEF", from: "#3DD68C", to: "#1FA2A6" },
  keira: { bg: "#FFEAF4", from: "#FF7EB6", to: "#B37BFF" },
  abishek: { bg: "#FFF7D9", from: "#FFC93C", to: "#FF8A3D" },
  muse: { bg: "#EEE9FF", from: "#7B61FF", to: "#FF6CAB" },
};

export function museAvatar(c: MuseColors, opts: { bot?: boolean } = {}): string {
  const id = `g${c.from.slice(1)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.from}"/><stop offset="1" stop-color="${c.to}"/></linearGradient></defs>
<rect width="120" height="120" fill="${c.bg}"/>
<ellipse cx="60" cy="106" rx="30" ry="5" fill="#000" opacity=".07"/>
<path d="M60 34c22 0 38 15 38 36 0 19-15 32-38 32S22 89 22 70c0-21 16-36 38-36z" fill="url(#${id})"/>
<ellipse cx="46" cy="50" rx="10" ry="6" fill="#fff" opacity=".28" transform="rotate(-25 46 50)"/>
<path d="M60 9l3.6 9.4L73 22l-9.4 3.6L60 35l-3.6-9.4L47 22l9.4-3.6z" fill="${opts.bot ? "#fff" : "#FFD54A"}" stroke="${opts.bot ? c.from : "#F2B705"}" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="78" cy="16" r="2.6" fill="${opts.bot ? "#fff" : "#FFD54A"}"/>
<ellipse cx="47" cy="68" rx="5.2" ry="6.6" fill="#1D1D2B"/><ellipse cx="73" cy="68" rx="5.2" ry="6.6" fill="#1D1D2B"/>
<circle cx="49" cy="65.5" r="1.9" fill="#fff"/><circle cx="75" cy="65.5" r="1.9" fill="#fff"/>
<ellipse cx="37" cy="80" rx="6" ry="3.6" fill="#FF8FAB" opacity=".75"/><ellipse cx="83" cy="80" rx="6" ry="3.6" fill="#FF8FAB" opacity=".75"/>
<path d="M53 80q7 7 14 0" stroke="#1D1D2B" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const museAvatarFor = (id: string) => museAvatar(MUSE_COLORS[id] ?? MUSE_COLORS.muse, { bot: id === "muse" });
