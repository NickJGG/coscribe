import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og/card";
import { SiteCard } from "@/lib/og/site";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "Coscribe: write one story together, live, with your friends.";

export default function Image() {
  return ogImage(<SiteCard />);
}
