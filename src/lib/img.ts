// Image URL helpers shared by seed data, server code and client components.
// Placeholder services are routed through /api/img so they are cached locally after first load.

export const proxied = (url: string) => (/^https?:\/\/(picsum\.photos|fastly\.picsum\.photos|i\.pravatar\.cc)\//.test(url) ? `/api/img?u=${encodeURIComponent(url)}` : url);
export const photoUrl = (seed: string, w = 800, h = 600) => proxied(`https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`);
export const faceUrl = (n: number) => proxied(`https://i.pravatar.cc/300?img=${n}`);
