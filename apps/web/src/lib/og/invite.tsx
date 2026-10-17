import type { BandSegment } from "./band";
import { Avatar, Card, eyebrow, INK, MUTED } from "./card";
import { Blurb, Byline, Title } from "./story";

const names = new Intl.ListFormat("en", { type: "conjunction" });

export function InviteCard({
  inviter,
  inviterColor,
  reading,
  title,
  blurb,
  expires,
  others,
  band,
}: {
  inviter: string;
  inviterColor: string;
  reading: boolean;
  title: string;
  blurb: string | null;
  expires: string | null;
  others: string[];
  band: BandSegment[];
}) {
  return (
    <Card band={band} corner={expires && <div style={{ ...eyebrow, fontSize: 20 }}>{`Expires on ${expires}`}</div>}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 30, color: MUTED }}>
        <Avatar name={inviter} color={inviterColor} size={60} />
        <div style={{ display: "flex" }}>
          <span style={{ fontWeight: 600, color: INK }}>{inviter}</span>
          {` invited you to ${reading ? "read" : "write"}`}
        </div>
      </div>
      <Title size={72}>{title}</Title>
      {blurb && <Blurb>{blurb}</Blurb>}
      {others.length > 0 && <Byline>{`with ${names.format(others)}`}</Byline>}
    </Card>
  );
}
