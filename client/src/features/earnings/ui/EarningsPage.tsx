import { useCallback, useEffect, useMemo, useState } from "react";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import { useAuth } from "@/features/auth/model/auth-context";
import { formatJobReference } from "@interpret-hub/shared";
import styles from "./EarningsPage.module.css";

type EarningsRange = "all" | "week" | "month" | "quarter" | "year";

type EarningRow = {
  id: number;
  amount: number;
  hours: number | null;
  mileageAmount: number | null;
  travelAmount: number | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
  job: {
    id: number;
    jobCode: string | null;
    language: string;
    startTime: string;
    endTime?: string;
    serviceType?: string;
    serviceCategory?: string;
  } | null;
  interpreter?: { id: number; name: string; email: string };
};

type EarningDetail = EarningRow & {
  serviceAmount: number;
  expectedPayDate: string | null;
  job: NonNullable<EarningRow["job"]> & {
    targetLanguage?: string | null;
    interpretationType?: string | null;
    client?: { name: string } | null;
  };
};

const RANGE_ORDER: EarningsRange[] = ["week", "month", "quarter", "year", "all"];

const RANGE_LABELS: Record<EarningsRange, string> = {
  all: "All time",
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

export function EarningsPage() {
  const { user } = useAuth();
  const showInterpreterCol = user?.role !== "INTERPRETER";
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [range, setRange] = useState<EarningsRange>("month");
  const [rows, setRows] = useState<EarningRow[]>([]);
  const [paySchedule, setPaySchedule] = useState("15,LAST");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<EarningDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = range === "all" ? "" : `?range=${encodeURIComponent(range)}`;
    api
      .get<EarningRow[]>(`/earnings${q}`)
      .then((r) => setRows(r.data))
      .catch(() => setError("Could not load earnings."))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get<{ linguistPaydays?: string }>("/settings")
      .then((r) => setPaySchedule(r.data.linguistPaydays?.trim() || "15,LAST"))
      .catch(() => {});
  }, []);

  async function markPaid(earningId: number) {
    try {
      await api.patch(`/earnings/${earningId}`, {
        status: "PAID",
        paidAt: new Date().toISOString(),
      });
      load();
    } catch {
      setError("Could not mark as paid.");
    }
  }

  async function openDetail(id: number) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const { data } = await api.get<EarningDetail>(`/earnings/${id}`);
      setDetail(data);
    } catch {
      setError("Could not load earning details.");
    } finally {
      setDetailLoading(false);
    }
  }

  const totals = useMemo(() => {
    const pending = rows.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.amount, 0);
    const paid = rows.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amount, 0);
    return { pending, paid, all: pending + paid };
  }, [rows]);

  function printReport() {
    window.print();
  }

  if (loading) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  if (error && rows.length === 0) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${styles.screenOnly}`}>
        <div>
          <h1 className={styles.title}>Earnings</h1>
          <p className={styles.lead}>Recorded payouts and pending amounts from completed work</p>
        </div>
        <button type="button" className={styles.printBtn} onClick={printReport}>
          Print report
        </button>
      </header>

      {error && rows.length > 0 ? <p className={`${styles.banner} ${styles.screenOnly}`}>{error}</p> : null}

      <div className={`${styles.toolbar} ${styles.screenOnly}`}>
        {RANGE_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            className={k === range ? styles.filterActive : styles.filterBtn}
            onClick={() => setRange(k)}
          >
            {RANGE_LABELS[k]}
          </button>
        ))}
      </div>

      <div className={`${styles.summary} ${styles.screenOnly}`}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Pending</span>
          <span className={styles.summaryValue}>{formatMoney(totals.pending)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Paid (in view)</span>
          <span className={styles.summaryValue}>{formatMoney(totals.paid)}</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Total</span>
          <span className={styles.summaryValue}>{formatMoney(totals.all)}</span>
        </div>
      </div>

      <div className={`${styles.card} ${styles.screenOnly}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Job</th>
              <th>Language</th>
              <th>Amount</th>
              <th>Status</th>
              {showInterpreterCol ? <th>Interpreter</th> : null}
              {isStaff ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + (showInterpreterCol ? 1 : 0) + (isStaff ? 1 : 0)}
                  className={styles.empty}
                >
                  No earnings in this period.
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr
                  key={e.id}
                  className={styles.clickRow}
                  onClick={() => void openDetail(e.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      void openDetail(e.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Earning details for job ${e.job ? formatJobReference(e.job) : "unknown"}`}
                >
                  <td>{e.job ? formatJobReference(e.job) : "—"}</td>
                  <td>{e.job?.language ?? "—"}</td>
                  <td>{formatMoney(e.amount)}</td>
                  <td>{e.status}</td>
                  {showInterpreterCol ? <td>{e.interpreter ? e.interpreter.name : "—"}</td> : null}
                  {isStaff ? (
                    <td
                      onClick={(ev) => ev.stopPropagation()}
                      onKeyDown={(ev) => ev.stopPropagation()}
                      role="presentation"
                    >
                      {e.status === "PENDING" ? (
                        <button type="button" className={styles.payBtn} onClick={() => markPaid(e.id)}>
                          Mark paid
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detail || detailLoading ? (
        <div
          className={`${styles.modalBackdrop} ${styles.screenOnly}`}
          role="presentation"
          onClick={() => !detailLoading && setDetail(null)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="earning-detail-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <h2 id="earning-detail-title" className={styles.modalTitle}>
                Earning breakdown
              </h2>
              <button type="button" className={styles.modalClose} onClick={() => setDetail(null)}>
                Close
              </button>
            </div>
            {detailLoading ? (
              <div className={styles.modalBody}>
                <Oval height={36} width={36} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
              </div>
            ) : detail ? (
              <div className={styles.modalBody}>
                <p className={styles.modalMeta}>
                  Job <strong>{formatJobReference(detail.job)}</strong> · {detail.job.language}
                  {detail.job.targetLanguage ? ` → ${detail.job.targetLanguage}` : ""}
                </p>
                <table className={styles.breakdown}>
                  <tbody>
                    <tr>
                      <th scope="row">Service</th>
                      <td>{formatMoney(detail.serviceAmount)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Mileage</th>
                      <td>{formatMoney(detail.mileageAmount ?? 0)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Travel</th>
                      <td>{formatMoney(detail.travelAmount ?? 0)}</td>
                    </tr>
                    <tr className={styles.breakdownTotal}>
                      <th scope="row">Total</th>
                      <td>{formatMoney(detail.amount)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Billable hours</th>
                      <td>{detail.hours != null ? `${detail.hours.toFixed(2)} h` : "—"}</td>
                    </tr>
                    <tr>
                      <th scope="row">Recorded</th>
                      <td>{formatWhen(detail.createdAt)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Status</th>
                      <td>{detail.status}</td>
                    </tr>
                    {detail.status === "PAID" && detail.paidAt ? (
                      <tr>
                        <th scope="row">Paid on</th>
                        <td>{formatWhen(detail.paidAt)}</td>
                      </tr>
                    ) : detail.expectedPayDate ? (
                      <tr>
                        <th scope="row">Next pay date</th>
                        <td>{formatWhen(detail.expectedPayDate)}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                <p className={styles.modalFoot}>Pay dates: {paySchedule}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div id="earnings-print-root" className={styles.printRoot} aria-hidden="true">
        <div className={styles.printInner}>
          <div className={styles.printBrand}>
            <img src="/iiw-logo.png" alt="" className={styles.printLogo} width={160} height={48} />
            <div>
              <div className={styles.printCompany}>InterpreterHub</div>
              <div className={styles.printTagline}>Linguist earnings statement</div>
            </div>
          </div>
          <h1 className={styles.printH1}>Earnings report</h1>
          <p className={styles.printPeriod}>
            {RANGE_LABELS[range]} · Generated {new Date().toLocaleString()}
          </p>
          <p className={styles.printSub}>Pay schedule: {paySchedule}</p>
          <table className={styles.printTable}>
            <thead>
              <tr>
                <th>Job</th>
                <th>Language</th>
                <th>Amount</th>
                <th>Hours</th>
                <th>Status</th>
                {showInterpreterCol ? <th>Interpreter</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={`p-${e.id}`}>
                  <td>{e.job ? formatJobReference(e.job) : "—"}</td>
                  <td>{e.job?.language ?? "—"}</td>
                  <td>{formatMoney(e.amount)}</td>
                  <td>{e.hours != null ? e.hours.toFixed(2) : "—"}</td>
                  <td>{e.status}</td>
                  {showInterpreterCol ? <td>{e.interpreter?.name ?? "—"}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.printTotals}>
            <div>
              <strong>Pending</strong> {formatMoney(totals.pending)}
            </div>
            <div>
              <strong>Paid</strong> {formatMoney(totals.paid)}
            </div>
            <div>
              <strong>Total</strong> {formatMoney(totals.all)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
