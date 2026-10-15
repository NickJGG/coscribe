import type { Page } from "playwright";
import type { DemoUser, Role } from "./demo";
import type { DemoStory } from "./story";

export type ShotContext = DemoStory & { users: Record<Role, DemoUser> };

export type Shot = {
  /** The file stem: `<name>.webp` and `<name>.dark.webp`. */
  name: string;
  as: Role | "signedOut";
  path: string | ((ctx: ShotContext) => string);
  viewport: { width: number; height: number };
  /** Screenshot just this element instead of the viewport. */
  frame?: string;
  setup?: (page: Page, ctx: ShotContext) => Promise<void>;
  /** A second User on the same path, kept open through the shot, for collaborative shots. Set up first. */
  with?: { as: Role; setup?: (page: Page, ctx: ShotContext) => Promise<void> };
};
