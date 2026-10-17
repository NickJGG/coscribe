import type { CSSProperties, ReactElement, ReactNode } from "react";
import { ImageResponse } from "next/og";
import type { BandSegment } from "./band";
import { ogFonts } from "./fonts";

/**
 * The share cards' "ribbon band" frame: paper, the logo and wordmark top-left, and a full-width band
 * along the bottom edge. An image can't follow the viewer's theme, so every color is the light theme's.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

export const INK = "#1f1d1a";
export const MUTED = "#6b665e";
export const FAINT = "#9a9389";
const PAPER = "#fbf8f3";
const ACCENT = "#b5441a";

export const UI = "Inter";
export const PROSE = "Literata";

export async function ogImage(element: ReactElement) {
  return new ImageResponse(element, { ...OG_SIZE, fonts: await ogFonts() });
}

/** Satori's clamp only takes effect on a block box. */
export function clamp(lines: number): CSSProperties {
  return { display: "block", lineClamp: lines };
}

export const eyebrow: CSSProperties = {
  fontFamily: UI,
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: 3,
  textTransform: "uppercase",
  color: MUTED,
};

export function Card({ corner, band, children }: { corner?: ReactNode; band: BandSegment[]; children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: "64px 80px 0",
        background: PAPER,
        color: INK,
        fontFamily: UI,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 600 }}>
          <Logo size={52} />
          Coscribe
        </div>
        {corner}
      </div>
      {children}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 24, display: "flex" }}>
        {band.map((s, i) => (
          <div key={i} style={{ flexGrow: s.grow, flexBasis: 0, minWidth: 6, background: s.color }} />
        ))}
      </div>
    </div>
  );
}

/** `app/icon.svg` in its light colors. */
function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect fill={INK} x="4" y="4" width="92" height="92" rx="22" />
      <path fill={ACCENT} d="M64 4H80V40L72 33L64 40Z" />
      <path
        fill={PAPER}
        d="M45.34 74.9Q40.67 74.9 37.25 72.91Q33.82 70.93 31.9 67.22Q29.98 63.5 29.98 58.19Q29.98 52.75 32.06 48.69Q34.14 44.62 37.92 42.38Q41.7 40.14 46.82 40.14Q50.46 40.14 53.09 41.33Q55.71 42.51 57.12 44.4Q58.53 46.29 58.53 48.53Q58.53 49.81 58.05 50.86Q57.57 51.92 56.58 52.56Q55.58 53.2 54.05 53.2Q52 53.2 50.94 52.27Q49.89 51.34 49.89 49.81Q49.89 48.78 50.53 47.47Q51.17 46.16 52.58 43.79Q51.42 42.9 50.05 42.45Q48.67 42 46.94 42Q44.58 42 42.72 43.44Q40.86 44.88 39.84 47.95Q38.82 51.02 38.82 55.82Q38.82 62.35 41.34 65.74Q43.87 69.14 48.48 69.14Q51.42 69.14 53.7 68.18Q55.97 67.22 57.82 65.62L58.85 66.64Q56.61 70.67 53.28 72.78Q49.95 74.9 45.34 74.9Z"
      />
    </svg>
  );
}

/** An avatar letter in the person's Author Color. */
export function Avatar({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: size / 2,
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.46),
        fontWeight: 600,
      }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}
