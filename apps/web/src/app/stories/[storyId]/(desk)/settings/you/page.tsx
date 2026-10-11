import { notFound } from "next/navigation";
import { getStory } from "@/lib/story";
import { requireProfile } from "@/lib/viewer";
import { colorName } from "@/lib/profile-rules";
import { canLeave, isWriter } from "@/lib/story-roles";
import { leaveStory } from "@/lib/actions/stories";
import { ActionForm } from "@/components/ActionForm";
import { Card, Sub } from "../Card";
import { StoryColorPicker } from "./StoryColorPicker";
import { StoryNotifyChoice } from "./StoryNotifyChoice";
import styles from "../settings.module.css";

export default async function StorySettingsYouPage(props: PageProps<"/stories/[storyId]/settings/you">) {
  const { storyId } = await props.params;
  const me = await requireProfile(`/stories/${storyId}/settings/you`);
  const data = await getStory(storyId);
  if (!data?.myRole) notFound();
  const { story, members, myRole, myNotify } = data;

  const profileColor = me.profile.author_color;
  const mine = members.find((m) => m.profile.id === me.userId)?.profile.author_color ?? profileColor;
  const taken = new Map(
    members.filter((m) => m.profile.id !== me.userId).map((m) => [m.profile.author_color, m.profile.username]),
  );
  const owner = taken.get(profileColor);

  return (
    <>
      <Card title="You" description="Only affects you, in this Story.">
        {isWriter(myRole) && (
          <Sub>
            <StoryColorPicker storyId={story.id} selected={mine} taken={taken}>
              <p className={`muted ${styles.hint}`}>
                {mine === profileColor
                  ? "Your cursor and text tint here. Greyed colors belong to other Writers."
                  : owner
                    ? `You're ${colorName(mine)} in this Story because ${owner} is ${colorName(profileColor)}.`
                    : `You picked ${colorName(mine)} here. Your profile color is ${colorName(profileColor)}.`}
              </p>
            </StoryColorPicker>
          </Sub>
        )}
        <Sub>
          <StoryNotifyChoice storyId={story.id} selected={myNotify} viewer={!isWriter(myRole)} />
        </Sub>
      </Card>

      {canLeave(myRole) && (
        <Card title="Leave or delete" danger>
          <Sub>
            <div className={styles.inlineRow}>
              <div>
                <h3>Leave story</h3>
                <p className="muted">You&rsquo;ll need a new Invite to come back.</p>
              </div>
              <ActionForm
                action={leaveStory.bind(null, story.id)}
                confirm="Leave this story? You'll need a new Invite to come back."
              >
                <button className="button button-danger">Leave story</button>
              </ActionForm>
            </div>
          </Sub>
        </Card>
      )}
    </>
  );
}
