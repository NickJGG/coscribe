import { Bar, Loading } from "@/components/Skeleton";
import { ProfileFormSkeleton } from "@/components/ProfileFormSkeleton";
import { Card, InlineRow, Sub } from "@/components/SettingsCard";

export default function SettingsLoading() {
  return (
    <Loading>
      <div className="page">
        <h1>Settings</h1>

        <Card
          title="Profile"
          description={
            <>
              What people see on <u>your profile</u> and beside your writing.
            </>
          }
        >
          <Sub>
            <ProfileFormSkeleton showBio />
          </Sub>
        </Card>

        <Card title="Preferences">
          <Sub>
            <InlineRow>
              <div>
                <h3>Theme</h3>
                <p className="muted">Auto follows your device&rsquo;s light or dark setting.</p>
              </div>
              <Bar width={170} height={28} round />
            </InlineRow>
          </Sub>
          <Sub>
            <InlineRow>
              <div>
                <h3>Show me as online</h3>
                <p className="muted">
                  Friends see when you&rsquo;re online, and which Story you&rsquo;re writing in if they can read it.
                  Co-writers always see you inside a Story you share.
                </p>
              </div>
              <Bar width={28} height={16} round />
            </InlineRow>
          </Sub>
        </Card>

        <Card title="Your data">
          <Sub>
            <InlineRow>
              <div>
                <h3>Download your data</h3>
                <p className="muted">
                  Your profile, Friends, Notes and Story Chat messages, plus a Markdown copy of each Story you write in.
                </p>
              </div>
              <Bar width="9rem" height={40} />
            </InlineRow>
          </Sub>
        </Card>

        <Card title="Leave Coscribe" danger>
          <Sub>
            <InlineRow>
              <div>
                <h3>Delete account</h3>
                <p className="muted">
                  Remove your account and sign out everywhere. You&rsquo;ll hand over any Stories you Host first.
                </p>
              </div>
              <Bar width="9rem" height={40} />
            </InlineRow>
          </Sub>
        </Card>
      </div>
    </Loading>
  );
}
