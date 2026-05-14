import { useEffect, useId, useRef } from "react";
import inviteStyles from "@/features/settings/ui/InviteUserDialog.module.css";
import styles from "./ViewClientDialog.module.css";

export type ClientDetail = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  organization: string | null;
  industry: string | null;
  address: string | null;
  /** Plain USD amounts (backend storage) */
  rateInPerson: number;
  ratePhone: number;
  rateVirtual: number;
  rateMileage: number;
  rateTravelTime: number;
  /** From API: `$X.XX per hour` or `$X.XX per mile` */
  rateInPersonFormatted?: string;
  ratePhoneFormatted?: string;
  rateVirtualFormatted?: string;
  rateMileageFormatted?: string;
  rateTravelTimeFormatted?: string;
};

function dash(s: string | null | undefined): string {
  const t = s?.trim();
  return t ? t : "—";
}

function fallbackHour(n: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " per hour"
  );
}

function fallbackMile(n: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " per mile"
  );
}

export function ViewClientDialog({
  client,
  open,
  onClose,
}: {
  client: ClientDetail | null;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && client) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open, client]);

  function closeDialog() {
    onClose();
  }

  if (!client) return null;

  return (
    <dialog
      ref={dialogRef}
      className={`${inviteStyles.dialog} ${styles.dialogWide}`}
      aria-labelledby={titleId}
      onClose={closeDialog}
      onCancel={(ev) => {
        ev.preventDefault();
        closeDialog();
      }}
    >
      <div className={`${inviteStyles.inner} ${styles.innerScroll}`}>
        <header className={inviteStyles.head}>
          <h2 id={titleId} className={inviteStyles.title}>
            Client details
          </h2>
          <p className={inviteStyles.sub}>Information used when generating invoices in Reports.</p>
        </header>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Company</h3>
          <dl className={styles.grid}>
            <dt>Company name</dt>
            <dd>{dash(client.organization)}</dd>
            <dt>Industry</dt>
            <dd>{dash(client.industry)}</dd>
            <dt>Address</dt>
            <dd className={styles.multiline}>{dash(client.address)}</dd>
          </dl>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Main point of contact</h3>
          <dl className={styles.grid}>
            <dt>Name</dt>
            <dd>{dash(client.name)}</dd>
            <dt>Email</dt>
            <dd>{dash(client.email)}</dd>
            <dt>Phone</dt>
            <dd>{dash(client.phone)}</dd>
          </dl>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Service rates</h3>
          <p className={styles.ratesLead}>Applied on invoices from Reports.</p>
          <dl className={styles.ratesGrid}>
            <dt>In-person</dt>
            <dd>{client.rateInPersonFormatted ?? fallbackHour(client.rateInPerson)}</dd>
            <dt>Phone</dt>
            <dd>{client.ratePhoneFormatted ?? fallbackHour(client.ratePhone)}</dd>
            <dt>Virtual</dt>
            <dd>{client.rateVirtualFormatted ?? fallbackHour(client.rateVirtual)}</dd>
            <dt>Mileage</dt>
            <dd>{client.rateMileageFormatted ?? fallbackMile(client.rateMileage)}</dd>
            <dt>Travel time</dt>
            <dd>{client.rateTravelTimeFormatted ?? fallbackHour(client.rateTravelTime)}</dd>
          </dl>
        </section>

        <div className={inviteStyles.actions}>
          <button type="button" className={inviteStyles.cancel} onClick={closeDialog}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
