"use client";

import { useState } from "react";
import { deleteAccount } from "@/lib/actions/account";
import { ActionForm } from "@/components/ActionForm";
import styles from "./delete-account.module.css";

/** Typing the username enables Delete, once nothing is left to hand over. */
export function DeleteAccountForm({ username, handOvers }: { username: string; handOvers: number }) {
  const [typed, setTyped] = useState("");

  return (
    <ActionForm action={deleteAccount} className={styles.confirm}>
      <label className={styles.field}>
        <span>
          Type <strong>{username}</strong> to confirm
        </span>
        <input
          name="username"
          className="input"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </label>
      <div className="row-actions">
        <button className="button button-danger" disabled={handOvers > 0 || typed !== username}>
          Delete account
        </button>
        {handOvers > 0 && (
          <span className="muted">Hand over {handOvers === 1 ? "1 Story" : `${handOvers} Stories`} first.</span>
        )}
      </div>
    </ActionForm>
  );
}
