import type { NextConfig } from "next";

/**
 * Wer darf die eingebetteten Ansichten in ein iframe holen?
 *
 * Ohne Angabe bleibt es beim Verhalten des Browsers – jede Seite darf
 * einbetten. Sobald `EMBED_FRAME_ANCESTORS` gesetzt ist (Leerzeichen-getrennte
 * Herkünfte, z. B. "https://atciss.vatsim-germany.org"), gilt die Liste, und
 * alles andere wird abgewiesen. Die Beschränkung gilt bewusst nur für /embed:
 * Der Rest der Anwendung soll gar nicht erst in fremden Fenstern landen.
 */
const frameAncestors = process.env.EMBED_FRAME_ANCESTORS?.trim();

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  async headers() {
    if (!frameAncestors) return [];
    return [
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
