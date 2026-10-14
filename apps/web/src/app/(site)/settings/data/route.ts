import { buildAccountZip } from "@/lib/account-export";
import { requireProfile } from "@/lib/viewer";

/** Download your data, as a .zip. */
export async function GET() {
  const { userId, profile } = await requireProfile("/settings");
  const zip = await buildAccountZip(userId);
  return new Response(zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="coscribe-${profile.username}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
