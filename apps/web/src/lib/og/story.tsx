import type { BandSegment } from "./band";
import { Card, clamp, eyebrow, MUTED, PROSE } from "./card";

const names = new Intl.ListFormat("en", { type: "conjunction" });

export function StoryCard({
  title,
  blurb,
  finished,
  writers,
  band,
}: {
  title: string;
  blurb: string | null;
  finished: boolean;
  writers: string[];
  band: BandSegment[];
}) {
  return (
    <Card band={band} corner={<div style={eyebrow}>{finished ? "Finished" : "Being written"}</div>}>
      <Title>{title}</Title>
      {blurb && <Blurb>{blurb}</Blurb>}
      {writers.length > 0 && <Byline>{`by ${names.format(writers)}`}</Byline>}
    </Card>
  );
}

export function Title({ size = 76, children }: { size?: number; children: string }) {
  return (
    <div style={{ ...clamp(2), maxWidth: 1000, fontFamily: PROSE, fontSize: size, fontWeight: 600, lineHeight: 1.15 }}>
      {children}
    </div>
  );
}

export function Blurb({ children }: { children: string }) {
  return (
    <div
      style={{
        ...clamp(2),
        maxWidth: 960,
        fontFamily: PROSE,
        fontStyle: "italic",
        fontSize: 30,
        lineHeight: 1.35,
        color: MUTED,
      }}
    >
      {children}
    </div>
  );
}

/** Sits at the foot of the card, just above the band. */
export function Byline({ children }: { children: string }) {
  return (
    <div
      style={{
        ...clamp(1),
        maxWidth: 1040,
        marginTop: "auto",
        marginBottom: 64,
        fontFamily: PROSE,
        fontStyle: "italic",
        fontSize: 32,
        lineHeight: 1.3,
      }}
    >
      {children}
    </div>
  );
}
