import { Bar, Loading } from "@/components/Skeleton";
import styles from "./SignInButtons.module.css";

export default function LoginLoading() {
  return (
    <Loading>
      <div className="page">
        <h1>Sign in</h1>
        <p className="muted">
          Writers sign in to pick a username and an author color. You don&rsquo;t need an account to watch a public
          story.
        </p>
        <div className={styles.buttons}>
          <Bar width="100%" height={40} />
          <Bar width="100%" height={40} />
        </div>
      </div>
    </Loading>
  );
}
