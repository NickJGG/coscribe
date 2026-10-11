"use client";

import { useActionState, useEffect, useState } from "react";
import { isUsernameAvailable, saveProfile, type ProfileFormState } from "@/lib/actions/profile";
import { BIO_MAX, normalizeUsername, usernameError } from "@/lib/profile-rules";
import { ColorSwatches } from "./ColorSwatches";
import styles from "./ProfileForm.module.css";

type Availability = "idle" | "checking" | "available" | "taken";

export function ProfileForm({
  initial,
  next,
  submitLabel,
  showBio = false,
}: {
  initial: { username: string; authorColor: string; bio: string };
  next?: string;
  submitLabel: string;
  showBio?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ProfileFormState, FormData>(saveProfile, initial);
  const [username, setUsername] = useState(state.username);
  const [bio, setBio] = useState(state.bio);
  const [checked, setChecked] = useState<{ username: string; available: boolean } | null>(null);

  const normalized = normalizeUsername(username);
  const localError = normalized ? usernameError(normalized) : null;
  const needsCheck = Boolean(normalized) && !localError && normalized !== initial.username;

  const availability: Availability = !needsCheck
    ? "idle"
    : checked?.username !== normalized
      ? "checking"
      : checked.available
        ? "available"
        : "taken";

  useEffect(() => {
    if (!needsCheck) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const available = await isUsernameAvailable(normalized);
      if (!stale) setChecked({ username: normalized, available });
    }, 400);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [normalized, needsCheck]);

  const usernameHint =
    state.usernameError && normalized === state.username
      ? { text: state.usernameError, error: true }
      : localError
        ? { text: localError, error: true }
        : availability === "taken"
          ? { text: "That username is taken.", error: true }
          : availability === "available"
            ? { text: "Available.", error: false }
            : availability === "checking"
              ? { text: "Checking…", error: false }
              : { text: "3–20 lowercase letters, numbers, or underscores.", error: false };

  return (
    <form action={formAction} className={styles.form}>
      {next && <input type="hidden" name="next" value={next} />}

      <div className={styles.field}>
        <label htmlFor="username" className={styles.label}>
          Username
        </label>
        <input
          id="username"
          name="username"
          className={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          required
          aria-invalid={usernameHint.error}
          aria-describedby="username-hint"
        />
        <p
          id="username-hint"
          aria-live="polite"
          className={usernameHint.error ? styles.error : availability === "available" ? styles.ok : "muted"}
        >
          {usernameHint.text}
        </p>
      </div>

      {showBio && (
        <div className={styles.field}>
          <label htmlFor="bio" className={styles.label}>
            Bio
          </label>
          <input
            id="bio"
            name="bio"
            className={`${styles.input} ${styles.wide}`}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
            aria-invalid={Boolean(state.bioError)}
            aria-describedby="bio-hint"
          />
          <p id="bio-hint" className={state.bioError ? styles.error : "muted"}>
            {state.bioError ?? `One line under your name on your profile. ${BIO_MAX - bio.length} characters left.`}
          </p>
        </div>
      )}

      <fieldset className={styles.field}>
        <legend className={styles.label}>Author color</legend>
        <p className="muted">
          Your cursor and your text tint, wherever you write. In a Story where another Writer already has it, you
          get the nearest free color.
        </p>
        <ColorSwatches name="author_color" selected={state.authorColor} />
        {state.colorError && <p className={styles.error}>{state.colorError}</p>}
      </fieldset>

      {state.formError && (
        <p role="alert" className={styles.error}>
          {state.formError}
        </p>
      )}

      <div>
        <button
          className="button button-primary"
          disabled={pending || Boolean(localError) || availability === "taken"}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
