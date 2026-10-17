import { AUTHOR_COLORS } from "@/lib/profile-rules";
import { Card, FAINT, PROSE } from "./card";

const BAND = AUTHOR_COLORS.map((color) => ({ color, grow: 1 }));

/** The site's card, and the fallback for anything a signed-out visitor can't see. */
export function SiteCard() {
  return (
    <Card band={BAND} corner={<div style={{ fontSize: 24, color: FAINT }}>coscribe.ink</div>}>
      <div style={{ fontFamily: PROSE, fontSize: 72, fontWeight: 600, lineHeight: 1.08, maxWidth: 940, marginTop: 30 }}>
        Write one story together, live, with your friends.
      </div>
      {/* One line, with clear space above it for the name tags so they never cover text. */}
      <div style={{ display: "flex", alignItems: "center", marginTop: 72, fontFamily: PROSE, fontSize: 36 }}>
        <Run color="#e2621b">The road ran white</Run>
        <Run color="#0b8fd6">&nbsp;with salt as far</Run>
        <Cursor name="mara" color="#0b8fd6" />
        <Run color="#3f9b4f">&nbsp;as the eye could see</Run>
        <Cursor name="juniper" color="#3f9b4f" />
      </div>
    </Card>
  );
}

function Run({ color, children }: { color: string; children: string }) {
  return <div style={{ color, flexShrink: 0, whiteSpace: "nowrap" }}>{children}</div>;
}

function Cursor({ name, color }: { name: string; color: string }) {
  return (
    <div style={{ display: "flex", position: "relative", width: 3, height: 40, margin: "0 2px", background: color }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 40,
          padding: "2px 8px",
          borderRadius: "4px 4px 4px 0",
          background: color,
          color: "#fff",
          fontFamily: "Inter",
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        {name}
      </div>
    </div>
  );
}
