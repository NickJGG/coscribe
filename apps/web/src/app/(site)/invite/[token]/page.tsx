import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import { getStory } from "@/lib/story";
import { isWriter } from "@/lib/story-roles";
import { acceptInviteLink } from "@/lib/actions/invites";
import { ActionForm } from "@/components/ActionForm";

export const metadata: Metadata = { title: "Invite", robots: { index: false } };

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_link_preview", { p_token: token }).maybeSingle();

  if (!data || data.used) {
    return (
      <div className="page">
        <h1>{data ? "This Invite Link has been used" : "This Invite Link doesn't work"}</h1>
        <p className="muted">
          Invite Links work once, for one person. Ask whoever sent it for a new one.
        </p>
      </div>
    );
  }

  if (data.expired) {
    return (
      <div className="page">
        <h1>This Invite Link has expired</h1>
        <p className="muted">Invite Links only last a while. Ask whoever sent it for a new one.</p>
      </div>
    );
  }

  const here = `/invite/${encodeURIComponent(token)}`;
  const viewer = await getViewer();
  const myRole = viewer?.profile ? (await getStory(data.story_id))?.myRole : null;
  const reading = data.role === "viewer";

  return (
    <div className="page">
      <p className="muted">
        {data.inviter_username} invited you to {reading ? "read" : "write in"}
      </p>
      <h1>{data.story_title}</h1>

      {myRole ? (
        <>
          <p className="muted">
            {isWriter(myRole) ? "You’re already writing in this story." : "You’re already reading this story."}
          </p>
          <div>
            <Link href={`/stories/${data.story_id}`} className="button button-primary">
              Open the story
            </Link>
          </div>
        </>
      ) : viewer?.profile ? (
        <>
          <p className="muted">
            {reading ? "Accepting lets you read along as it’s written." : "Accepting makes you a Writer."}
          </p>
          <ActionForm action={acceptInviteLink.bind(null, token)}>
            <div>
              <button className="button button-primary">{reading ? "Join as Viewer" : "Join as Writer"}</button>
            </div>
          </ActionForm>
        </>
      ) : (
        <div>
          <Link
            href={viewer ? `/onboarding?next=${encodeURIComponent(here)}` : `/login?next=${encodeURIComponent(here)}`}
            className="button button-primary"
          >
            {viewer ? "Choose your username to accept" : "Sign in to accept"}
          </Link>
        </div>
      )}
    </div>
  );
}
