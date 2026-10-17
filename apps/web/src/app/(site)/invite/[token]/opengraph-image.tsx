import { bandSegments } from "@/lib/og/band";
import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og/card";
import { InviteCard } from "@/lib/og/invite";
import { SiteCard } from "@/lib/og/site";
import { inviteLinkCard } from "@/lib/invite-card";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "An invitation to a Story on Coscribe";
export const revalidate = 300;

/** A used, expired or unknown Invite Link gets the site's card. */
export default async function Image(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const card = await inviteLinkCard(token);
  if (!card) return ogImage(<SiteCard />);

  return ogImage(
    <InviteCard
      inviter={card.inviter}
      inviterColor={card.inviterColor}
      reading={card.reading}
      title={card.title}
      blurb={card.blurb}
      expires={
        card.expiresAt &&
        new Date(card.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
      }
      others={card.writers.filter((w) => w.name !== card.inviter).map((w) => w.name)}
      band={bandSegments(card.writers, card.writers.map((w) => w.color))}
    />
  );
}
