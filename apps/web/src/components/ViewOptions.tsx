import { Dropdown } from "./Dropdown";
import { SlidersIcon } from "./icons";
import { Switch } from "./Switch";
import styles from "./ViewOptions.module.css";

type Setting = { show: boolean; setShow: (show: boolean) => void };

/**
 * The desk toolbar row's last control: the Show pins (not on phones), Show notes and Show authors switches,
 * each only where it applies, then Customize toolbar… when `onCustomize` is given.
 */
export function ViewOptions({
  notes,
  pins,
  showAuthors,
  onShowAuthors,
  onCustomize,
}: {
  notes: Setting | null;
  pins: Setting | null;
  showAuthors: boolean;
  onShowAuthors: (show: boolean) => void;
  onCustomize?: () => void;
}) {
  return (
    <Dropdown
      label="View options"
      tip="View options"
      trigger={<SlidersIcon />}
      triggerClassName={styles.trigger}
      panelClassName={styles.menu}
    >
      {pins && (
        <Switch checked={pins.show} onChange={pins.setShow} className={`${styles.row} ${styles.notPhone}`}>
          Show pins
        </Switch>
      )}
      {notes && (
        <Switch checked={notes.show} onChange={notes.setShow} className={styles.row}>
          Show notes
        </Switch>
      )}
      <Switch checked={showAuthors} onChange={onShowAuthors} className={styles.row}>
        Show authors
      </Switch>
      {onCustomize && (
        <>
          <hr className={styles.divider} />
          <button type="button" className={`${styles.row} ${styles.action}`} data-close onClick={onCustomize}>
            <SlidersIcon />
            Customize toolbar…
          </button>
        </>
      )}
    </Dropdown>
  );
}
