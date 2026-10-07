import type { Metadata } from "next";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/viewer";
import { relationTo, usernamePrefixPattern } from "@/lib/friends";
import { acceptFriendRequest, removeFriendship, sendFriendRequest } from "@/lib/actions/friends";
import { ActionForm } from "@/components/ActionForm";
import { PersonLink } from "@/components/PersonLink";

export const metadata: Metadata = { title: "Friends" };

type Person = { id: string; username: string; author_color: string };

export default async function FriendsPage(props: PageProps<"/friends">) {
  const me = await requireProfile("/friends");
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";
  const supabase = await createClient();

  const { data } = await supabase.from("friendships").select(`
    requester_id, addressee_id, status,
    requester:profiles!friendships_requester_id_fkey (id, username, author_color),
    addressee:profiles!friendships_addressee_id_fkey (id, username, author_color)
  `);
  const connections = (data ?? []).map((row) => ({
    ...row,
    other: row.requester_id === me.userId ? row.addressee : row.requester,
  }));
  const byName = (a: { other: Person }, b: { other: Person }) => a.other.username.localeCompare(b.other.username);
  const friends = connections.filter((c) => c.status === "accepted").sort(byName);
  const incoming = connections.filter((c) => c.status === "pending" && c.addressee_id === me.userId).sort(byName);
  const outgoing = connections.filter((c) => c.status === "pending" && c.requester_id === me.userId).sort(byName);

  const pattern = usernamePrefixPattern(query);
  const { data: results } = pattern
    ? await supabase
        .from("profiles")
        .select("id, username, author_color")
        .ilike("username", pattern)
        .neq("id", me.userId)
        .order("username")
        .limit(10)
    : { data: null };

  return (
    <div className="page">
      <h1>Friends</h1>

      <section className="section">
        <h2>Find writers</h2>
        <Form action="/friends" className="row-actions">
          <label htmlFor="q" className="sr-only">
            Username
          </label>
          <input
            id="q"
            name="q"
            className="input"
            defaultValue={query}
            placeholder="Search by username"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button className="button">Search</button>
        </Form>
        {results &&
          (results.length ? (
            <ul className="rows">
              {results.map((person) => (
                <li key={person.id} className="row">
                  <PersonLink person={person} />
                  <div className="row-actions">
                    <SearchResultAction relation={relationTo(me.userId, person.id, connections)} userId={person.id} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No writers match &ldquo;{query}&rdquo;.</p>
          ))}
      </section>

      {incoming.length > 0 && (
        <section className="section">
          <h2>Requests</h2>
          <ul className="rows">
            {incoming.map(({ other }) => (
              <li key={other.id} className="row">
                <PersonLink person={other} />
                <div className="row-actions">
                  <ActionForm action={acceptFriendRequest.bind(null, other.id)}>
                    <button className="button button-primary button-small">Accept</button>
                  </ActionForm>
                  <ActionForm action={removeFriendship.bind(null, other.id)}>
                    <button className="button button-small">Decline</button>
                  </ActionForm>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2>Your friends</h2>
        {friends.length ? (
          <ul className="rows">
            {friends.map(({ other }) => (
              <li key={other.id} className="row">
                <PersonLink person={other} />
                <ActionForm
                  action={removeFriendship.bind(null, other.id)}
                  confirm={`Remove ${other.username} from your friends?`}
                >
                  <button className="button button-small button-danger">Remove</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No friends yet. Search for a username above, or accept an Invite Link.</p>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="section">
          <h2>Sent requests</h2>
          <ul className="rows">
            {outgoing.map(({ other }) => (
              <li key={other.id} className="row">
                <PersonLink person={other} />
                <ActionForm action={removeFriendship.bind(null, other.id)}>
                  <button className="button button-small">Cancel</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SearchResultAction({ relation, userId }: { relation: ReturnType<typeof relationTo>; userId: string }) {
  switch (relation) {
    case "friends":
      return <span className="pill">Friends</span>;
    case "outgoing":
      return <span className="pill">Requested</span>;
    case "incoming":
      return (
        <ActionForm action={acceptFriendRequest.bind(null, userId)}>
          <button className="button button-primary button-small">Accept request</button>
        </ActionForm>
      );
    case "none":
      return (
        <ActionForm action={sendFriendRequest.bind(null, userId)}>
          <button className="button button-small">Add friend</button>
        </ActionForm>
      );
  }
}
