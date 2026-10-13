import type { NextRequest } from "next/server";
import { getExport } from "@/lib/export";
import { toEpub } from "@/lib/story-file/epub";
import { toMarkdown } from "@/lib/story-file/markdown";

/**
 * Downloads the Story: `?format=md|epub`, `bible=0` to leave out the Story Bible, `outlines=1` to add Outlines to a
 * Draft Export. A Draft the viewer can't export is a 404, so it doesn't give itself away.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/stories/[storyId]/export">) {
  const { storyId } = await ctx.params;
  const params = request.nextUrl.searchParams;
  const format = params.get("format");
  if (format !== "md" && format !== "epub") return new Response("Unknown format.", { status: 400 });

  const options = { bible: params.get("bible") !== "0", outlines: params.get("outlines") === "1" };
  const file = await getExport(storyId, options);
  if (file === "forbidden") return new Response("Not found.", { status: 404 });
  if (file === "unavailable") return new Response("Couldn't load the text, try again.", { status: 503 });

  const name = `${slug(file.title)}.${format}`;
  const body =
    format === "md" ? toMarkdown(file, options) : toEpub(file, { identifier: `urn:uuid:${storyId}` });
  return new Response(body as BodyInit, {
    headers: {
      "content-type": format === "md" ? "text/markdown; charset=utf-8" : "application/epub+zip",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}

function slug(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return words || "story";
}
