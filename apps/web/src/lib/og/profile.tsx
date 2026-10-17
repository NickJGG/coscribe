import { Avatar, Card, clamp, FAINT, MUTED, PROSE } from "./card";

export function ProfileCard({
  username,
  color,
  bio,
  since,
  passage,
}: {
  username: string;
  color: string;
  bio: string | null;
  since: string;
  passage: { text: string; from: string } | null;
}) {
  return (
    <Card band={[{ color, grow: 1 }]}>
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: -8 }}>
        <Avatar name={username} color={color} size={112} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: PROSE, fontSize: 56, fontWeight: 600, lineHeight: 1.2 }}>{username}</div>
          {bio && (
            <div
              style={{
                ...clamp(2),
                maxWidth: 880,
                marginTop: 4,
                fontFamily: PROSE,
                fontStyle: "italic",
                fontSize: 26,
                lineHeight: 1.3,
                color: MUTED,
              }}
            >
              {bio}
            </div>
          )}
          <div style={{ marginTop: 6, fontSize: 22, color: FAINT }}>{`Writing on Coscribe since ${since}`}</div>
        </div>
      </div>
      {passage && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 8 }}>
          <div
            style={{
              ...clamp(3),
              maxWidth: 1000,
              fontFamily: PROSE,
              fontStyle: "italic",
              fontSize: 34,
              lineHeight: 1.35,
            }}
          >
            {`“${passage.text}”`}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 24, color: MUTED }}>
            from
            <span style={{ fontFamily: PROSE, fontStyle: "italic" }}>{passage.from}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
