import { useEffect, useId, useRef, useState } from "react";
import { Oval } from "react-loader-spinner";
import { Link } from "react-router";
import { api } from "@/services/api/http-client";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import inviteStyles from "@/features/settings/ui/InviteUserDialog.module.css";
import styles from "./ViewLinguistDialog.module.css";

export type LinguistDetail = {
  id: number;
  name: string;
  email: string;
  role: string;
  languages: string[];
  interpreterStatus: string | null;
  phone: string | null;
  address: string | null;
  profilePhoto?: string | null;
  createdAt: string;
  accountLocked: boolean;
  interpreterProfile: {
    rateInPerson: number;
    rateVirtual: number;
    ratePhone: number;
    rateMileage: number;
    rateTravelTime: number;
  } | null;
};

function dash(s: string | null | undefined): string {
  const t = s?.trim();
  return t ? t : "—";
}

function formatHourUsd(n: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " per hour"
  );
}

function formatMileUsd(n: number): string {
  return (
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + " per mile"
  );
}

function resolvePayRates(detail: LinguistDetail): {
  rateInPerson: number;
  rateVirtual: number;
  ratePhone: number;
  rateMileage: number;
  rateTravelTime: number;
} {
  const p = detail.interpreterProfile;
  if (!p) {
    return { rateInPerson: 0, rateVirtual: 0, ratePhone: 0, rateMileage: 0, rateTravelTime: 0 };
  }
  return {
    rateInPerson: p.rateInPerson,
    rateVirtual: p.rateVirtual,
    ratePhone: p.ratePhone,
    rateMileage: p.rateMileage,
    rateTravelTime: p.rateTravelTime,
  };
}

function interpreterStatusLabel(st: string | null): string {
  if (!st) return "—";
  switch (st) {
    case "ACTIVE":
      return "Active";
    case "INACTIVE":
      return "Inactive";
    case "VACATION":
      return "Vacation";
    case "SICK_LEAVE":
      return "Sick leave";
    default:
      return st;
  }
}

function PayRatesSection({ detail }: { detail: LinguistDetail }) {
  const pay = resolvePayRates(detail);
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Linguist pay rates</h3>
      <p className={styles.ratesLead}>
        Hourly amounts by modality, plus mileage (per mile) and travel time (per hour). Separate from client billing rates (see
        Clients). Used for linguist payouts; job-level overrides may still apply.
      </p>
      {!detail.interpreterProfile ? (
        <p className={styles.profileMissing}>
          No pay profile saved yet — amounts show as $0.00 until you set them in User Management (Edit user → Linguist pay
          rates).
        </p>
      ) : null}
      <dl className={styles.ratesGrid}>
        <dt>In-person</dt>
        <dd>{formatHourUsd(pay.rateInPerson)}</dd>
        <dt>Virtual</dt>
        <dd>{formatHourUsd(pay.rateVirtual)}</dd>
        <dt>Phone</dt>
        <dd>{formatHourUsd(pay.ratePhone)}</dd>
        <dt>Mileage</dt>
        <dd>{formatMileUsd(pay.rateMileage)}</dd>
        <dt>Travel time</dt>
        <dd>{formatHourUsd(pay.rateTravelTime)}</dd>
      </dl>
    </section>
  );
}

export function ViewLinguistDialog({
  linguistId,
  open,
  onClose,
}: {
  linguistId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [detail, setDetail] = useState<LinguistDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && linguistId != null) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open, linguistId]);

  useEffect(() => {
    if (!open || linguistId == null) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);
    api
      .get<LinguistDetail>(`/api/users/${linguistId}`)
      .then((r) => {
        if (!cancelled) setDetail(r.data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load linguist details.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, linguistId]);

  function closeDialog() {
    onClose();
  }

  if (!open || linguistId == null) return null;

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
            Linguist details
          </h2>
          <p className={inviteStyles.sub}>
            Contact information and linguist pay rates (different from client billing). Edit pay amounts under Settings → User
            Management → Edit user.
          </p>
        </header>

        {loading ? (
          <div className={styles.loaderWrap}>
            <Oval height={36} width={36} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
          </div>
        ) : error ? (
          <p className={styles.errText}>{error}</p>
        ) : detail ? (
          <>
            {detail.role !== "INTERPRETER" ? (
              <p className={styles.errText}>This user is not an interpreter.</p>
            ) : (
              <>
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Contact</h3>
                  <dl className={styles.grid}>
                    <dt>Name</dt>
                    <dd>{dash(detail.name)}</dd>
                    <dt>Email</dt>
                    <dd>{dash(detail.email)}</dd>
                    <dt>Phone</dt>
                    <dd>{dash(detail.phone)}</dd>
                    <dt>Address</dt>
                    <dd className={styles.multiline}>{dash(detail.address)}</dd>
                  </dl>
                </section>

                <PayRatesSection detail={detail} />

                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Languages &amp; status</h3>
                  <dl className={styles.grid}>
                    <dt>Languages</dt>
                    <dd>{detail.languages?.length ? detail.languages.join(", ") : "—"}</dd>
                    <dt>Interpreter status</dt>
                    <dd>{interpreterStatusLabel(detail.interpreterStatus)}</dd>
                    <dt>Account locked</dt>
                    <dd>{detail.accountLocked ? "Yes" : "No"}</dd>
                  </dl>
                </section>
              </>
            )}

            <p className={styles.manageHint}>
              To edit roles, linguist pay rates, or invites, open{" "}
              <Link to="/settings?tab=users" onClick={closeDialog}>
                User Management
              </Link>{" "}
              and choose Edit user for this person.
            </p>
          </>
        ) : null}

        <div className={inviteStyles.actions}>
          <button type="button" className={inviteStyles.cancel} onClick={closeDialog}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
