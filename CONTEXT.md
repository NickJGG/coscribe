# Coscribe

A web app where invited friends write one story together live, all editing the same text at once, while anyone can watch public stories being written.

## Language

### Stories and their parts

**Story**:
A collaboratively written work made up of ordered **Chapters** plus one **Story Bible**.
_Avoid_: Document, project, room

**Blurb**:
A short description of a **Story**, written by its **Host**, shown under its title.
_Avoid_: Description, summary, tagline

**Chapter**:
One live-edited section of a **Story**'s prose.
_Avoid_: Page, section, part

**Story Bible**:
A **Story**'s shared reference of **Entries** that keeps writers consistent.
_Avoid_: Wiki, notes, lore doc

**Entry**:
One typed card in the **Story Bible** (Character, Place, Item, or Lore), with a name, a short description, and a body.
_Avoid_: Card, note, article

**Desk**:
The screen where a **Story** is written and watched: a sidebar of **Chapters** and **Entries** beside the open one.
_Avoid_: Editor, workspace

**Overview**:
A **Story**'s home page inside the **Desk**, showing its title, **Writers**, **Chapters** and **Story Bible** at a glance.
_Avoid_: Home, story page, dashboard

**Scene Break**:
The centered `* * *` divider between scenes inside a **Chapter**.
_Avoid_: Separator, horizontal rule

### People and roles

**Host**:
The single **User** who owns a **Story** and holds its top-level powers.
_Avoid_: Owner, admin, creator

**Co-host**:
A **Writer** the **Host** has promoted to moderate the **Story**.
_Avoid_: Moderator, editor

**Writer**:
A **User** invited to edit a specific **Story**.
_Avoid_: Contributor, member, collaborator, author (except in "author color")

**Viewer**:
Someone watching a **Story** live without edit rights, possibly not signed in.
_Avoid_: Spectator, reader, guest

**Friend**:
Another **User** with a mutually accepted friend connection.
_Avoid_: Contact, follower

**Author Color**:
The color a **User** picks for their live cursor and their text tint, which a **Story** replaces with a free one when another **Writer** there already has it.
_Avoid_: User color, cursor color

### Access

**Visibility**:
Whether a **Story** is **Public** (anyone may view) or **Private** (only invited people may view). It never affects who can edit.
_Avoid_: Privacy, access level

**Invite**:
A host-issued grant that makes one specific **User** a **Writer**, sent to a **Friend** on the site or as an **Invite Link**.
_Avoid_: Share, join request

**Invite Link**:
A single-use URL generated for one person that expires after first use.
_Avoid_: Share link, join link

### History and lifecycle

**Snapshot**:
A saved past state of a **Chapter**, taken automatically or on demand by a **Co-host** or **Host**, which can be named.
_Avoid_: Version, revision, backup

**Restore**:
Replacing a **Chapter**'s text with a **Snapshot**'s, recorded as a new change.
_Avoid_: Revert, rollback, undo

**Finished**:
The state of a **Story** whose **Host** has declared it complete, locking all content and showing the **Reader View**.
_Avoid_: Published, completed, archived

**Reader View**:
The polished, read-only presentation of a **Finished** **Story**, including its **Credits**.
_Avoid_: Book view, export

**Credits**:
The page in the **Reader View** listing each **Writer** and their contribution.

**Story Chat**:
The chat panel inside a **Story**, visible to **Writers** and above.
_Avoid_: Comments, messages

**Note**:
A remark pinned to a passage of a **Chapter**'s text that others can reply to, open until it is **Resolved**.
_Avoid_: Comment, annotation, margin note

**Resolved**:
A **Note** that is settled and leaves the margin. Any **Writer** can Resolve one or Reopen it.
_Avoid_: Closed, done, archived

**Detached**:
An open **Note** whose passage is gone from the **Chapter**, through deletion or a **Restore**. It can still be replied to and **Resolved**, and comes back if the passage does.
_Avoid_: Orphaned, broken

**Alias**:
Another name an **Entry** goes by in the prose, such as "Aldous" for "Keeper Aldous".
_Avoid_: Nickname, synonym

**Mention**:
A place in a **Chapter**'s text where an **Entry**'s name or **Alias** appears.
_Avoid_: Link, reference, tag

### Presence and notifications

**Online**:
A **User**'s state of having Coscribe open recently, shown to their **Friends** unless they turn it off.
_Avoid_: Active, available

**Presence**:
Which **Chapter** a **Writer** is in right now, shown only to people who can read that **Story**.
_Avoid_: Status, location, activity

**Notification**:
An in-app message telling one **User** that something happened in a **Story** they belong to or were invited to.
_Avoid_: Alert, activity, update

## Relationships

- A **Story** has exactly one **Host**, zero or more **Co-hosts**, and one or more **Writers** (the **Host** counts as one)
- A **Story** has one or more ordered **Chapters** and exactly one **Story Bible**
- A **Story Bible** has zero or more **Entries**
- A **Chapter** has zero or more **Snapshots**
- An **Invite** makes exactly one **User** a **Writer** of exactly one **Story**
- **Visibility** controls who sees a **Story**. Editing always requires an **Invite**.
- An **Entry** has zero or more **Aliases**; a **Chapter** has zero or more **Mentions** of **Entries**
- A **Chapter** has zero or more **Notes**; only **Writers** and above see them
- A **Notification** has exactly one recipient **User**
- **Viewers** have no **Presence**; they are only ever counted, never named

## Example dialogue

> **Dev:** "A **Viewer** on a **Public** story clicks 'Request to write.' What happens?"
> **Domain expert:** "There's no such button. A **Viewer** can only become a **Writer** if the **Host** or a **Co-host** sends them an **Invite**."
> **Dev:** "And if a **Writer** deletes half a **Chapter**?"
> **Domain expert:** "A **Co-host** opens the timeline and **Restores** an earlier **Snapshot**. Good text written since then can be copied back out of a newer **Snapshot**."

## Flagged ambiguities

- "public story" first sounded like strangers could join and edit. Resolved: **Visibility** only governs viewing; editing is always invite-only.
- "invite by link" could mean a reusable share link. Resolved: an **Invite Link** is single-use, for one person.
- "watching" could suggest a named audience. Resolved: **Viewers** are anonymous counts everywhere; only **Writers** have **Presence**.
- "revert" vs. **Restore**: the product action is **Restore** (to a **Snapshot**); per-user selective revert does not exist.
