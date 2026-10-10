import { Bar, Loading } from "@/components/Skeleton";
import items from "@/components/Notifications.module.css";
import styles from "./notifications.module.css";

export default function NotificationsLoading() {
  return (
    <Loading>
      <div className="page">
        <div className={styles.head}>
          <h1>Notifications</h1>
        </div>
        <div className={styles.list}>
          {["80%", "65%", "72%", "58%", "76%"].map((width, i) => (
            <div key={i} className={items.item}>
              <Bar width={26} height={26} round />
              <span className={items.text}>
                <Bar width={width} />
                <span className={items.when}>
                  <Bar width="4rem" />
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}
