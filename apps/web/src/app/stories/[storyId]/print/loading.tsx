import { Line, Lines, Loading } from "@/components/Skeleton";
import reader from "../read/reader.module.css";
import styles from "./print.module.css";

export default function PrintLoading() {
  return (
    <Loading>
      <div className={`${reader.page} ${styles.book}`}>
        <header className={`${reader.titlePage} ${styles.titlePage}`}>
          <Line as="h1" className={reader.bookTitle} width="16rem" />
          <Line className={reader.byline} width="10rem" />
        </header>
        <Lines count={12} className={reader.text} />
      </div>
    </Loading>
  );
}
