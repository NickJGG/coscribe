import Link from "next/link";
import { Bar, Line, Loading } from "@/components/Skeleton";
import styles from "./delete-account.module.css";

export default function DeleteAccountLoading() {
  return (
    <Loading>
      <div className="page">
        <Link href="/settings" className={styles.back}>
          &larr; Settings
        </Link>
        <div className={styles.head}>
          <h1>Delete your account</h1>
          <p className="muted">This can&rsquo;t be undone.</p>
        </div>
        <section className="section">
          <h2>What happens to your writing</h2>
          <div className="rows">
            {[["22rem", "26rem"], ["4rem", "22rem"]].map(([title, detail], i) => (
              <div key={i} className="row">
                <div className={styles.meta}>
                  <Bar width={title} />
                  <Line as="small" width={detail} />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="section">
          <Bar width="12rem" height={24} />
          <div className="rows">
            {["10rem", "14rem"].map((width, i) => (
              <div key={i} className="row">
                <Bar width={width} />
              </div>
            ))}
          </div>
        </section>
        <div className={styles.confirm}>
          <Bar width="11rem" />
          <Bar width={320} height={40} />
          <Bar width="8rem" height={40} />
        </div>
      </div>
    </Loading>
  );
}
