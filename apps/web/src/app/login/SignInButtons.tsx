"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./SignInButtons.module.css";

type Provider = "google" | "discord";

export function SignInButtons({ next }: { next: string }) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [failed, setFailed] = useState(false);

  async function signIn(provider: Provider) {
    setPending(provider);
    setFailed(false);
    const redirectTo = `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) {
      setPending(null);
      setFailed(true);
    }
  }

  return (
    <div className={styles.buttons}>
      <button className="button" disabled={pending !== null} onClick={() => signIn("google")}>
        {pending === "google" ? "Opening Google…" : "Continue with Google"}
      </button>
      <button
        className={`button ${styles.discord}`}
        disabled={pending !== null}
        onClick={() => signIn("discord")}
      >
        {pending === "discord" ? "Opening Discord…" : "Continue with Discord"}
      </button>
      {failed && (
        <p role="alert" className={styles.error}>
          Couldn&rsquo;t reach the sign-in provider. Try again.
        </p>
      )}
    </div>
  );
}
