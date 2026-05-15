import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Oval } from "react-loader-spinner";
import { api } from "@/services/api/http-client";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { LocalDateTimePicker } from "@/components/datetime/LocalDateTimePicker";
import {
  downloadReportExcel,
  jobsEligibleForQuickBooksBill,
  jobsEligibleForQuickBooksInvoice,
  type ReportExportJob,
  type ReportKind,
} from "@/features/reports/reportExcelExport";
import styles from "./ReportsPage.module.css";

type Stats = {
  jobs: { open: number; assigned: number; completed: number };
};

function normalizeStats(raw: unknown): Stats {
  const jobs =
    raw &&
    typeof raw === "object" &&
    "jobs" in raw &&
    raw.jobs &&
    typeof raw.jobs === "object"
      ? (raw.jobs as Record<string, unknown>)
      : {};
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    jobs: {
      open: n(jobs.open),
      assigned: n(jobs.assigned),
      completed: n(jobs.completed),
    },
  };
}

function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toInputDate(start), to: toInputDate(end) };
}

function localDayToIsoStart(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function localDayToIsoEnd(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

export function ReportsPage() {
  const defaults = useMemo(() => defaultDateRange(), []);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [reportKind, setReportKind] = useState<ReportKind>("invoice");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setStatsLoading(true);
    setStatsError(null);
    api
      .get("/dashboard/stats")
      .then((r) => setStats(normalizeStats(r.data)))
      .catch(() => setStatsError("Could not load report data."))
      .finally(() => setStatsLoading(false));
  }, []);

  async function generateExport() {
    setExportError(null);
    setExportMessage(null);
    setExportWarning(null);
    if (!fromDate || !toDate) {
      setExportError("Choose a start and end date.");
      return;
    }
    if (fromDate > toDate) {
      setExportError("Start date must be on or before end date.");
      return;
    }

    const startIso = localDayToIsoStart(fromDate);
    const endIso = localDayToIsoEnd(toDate);
    setExportLoading(true);
    try {
      const { data } = await api.get<{
        jobs: ReportExportJob[];
        truncated?: boolean;
        pendingReviewUnpaidCount?: number;
      }>("/reports/jobs-for-export", { params: { startTimeMin: startIso, startTimeMax: endIso } });

      const jobs = data.jobs ?? [];
      const pending = data.pendingReviewUnpaidCount ?? 0;
      if (pending > 0) {
        setExportWarning(
          `${pending} assignment(s) in this date range have paperwork submitted for review, are not approved yet, and are not marked paid. Review them under Assignments (Submissions tab when applicable).`,
        );
      }

      let exportJobs: ReportExportJob[] = jobs;
      if (reportKind === "invoice") {
        const withoutClient = jobs.filter((j) => !j.client).length;
        const eligible = jobsEligibleForQuickBooksInvoice(jobs);
        if (eligible.length === 0) {
          if (jobs.length === 0) {
            /* fall through to generic empty message below */
          } else if (withoutClient === jobs.length) {
            setExportMessage(
              "No jobs with a linked client; QuickBooks-style invoices need a customer on each assignment.",
            );
            return;
          } else {
            setExportMessage(
              "No billable lines to export: add session hours, mileage, or billable travel on assignments (or confirm client billing rates on the client profile).",
            );
            return;
          }
        } else {
          exportJobs = eligible;
          const extras: string[] = [];
          if (withoutClient > 0) {
            extras.push(`${withoutClient} assignment(s) without a linked customer were omitted.`);
          }
          const eligibleIds = new Set(eligible.map((j) => j.id));
          const withClientButNoLines = jobs.filter((j) => j.client && !eligibleIds.has(j.id)).length;
          if (withClientButNoLines > 0) {
            extras.push(
              `${withClientButNoLines} assignment(s) with a customer had no billable hours, mileage, or travel and were omitted.`,
            );
          }
          if (extras.length > 0) {
            setExportWarning((prev) => (prev ? `${prev}\n\n${extras.join(" ")}` : extras.join(" ")));
          }
        }
      } else if (reportKind === "bill") {
        const withoutInterpreter = jobs.filter((j) => !j.interpreter).length;
        const eligible = jobsEligibleForQuickBooksBill(jobs);
        if (eligible.length === 0) {
          if (jobs.length === 0) {
            /* fall through */
          } else if (withoutInterpreter === jobs.length) {
            setExportMessage(
              "No jobs with an assigned interpreter; QuickBooks-style bills need a supplier (interpreter) on each assignment.",
            );
            return;
          } else {
            setExportMessage(
              "No billable lines to export: add session hours, mileage, or billable travel (or confirm linguist pay rates on the interpreter profile).",
            );
            return;
          }
        } else {
          exportJobs = eligible;
          const extras: string[] = [];
          if (withoutInterpreter > 0) {
            extras.push(`${withoutInterpreter} assignment(s) without an assigned interpreter were omitted.`);
          }
          const eligibleIds = new Set(eligible.map((j) => j.id));
          const withInterpreterButNoLines = jobs.filter((j) => j.interpreter && !eligibleIds.has(j.id)).length;
          if (withInterpreterButNoLines > 0) {
            extras.push(
              `${withInterpreterButNoLines} assignment(s) with an interpreter had no billable hours, mileage, or travel and were omitted.`,
            );
          }
          if (extras.length > 0) {
            setExportWarning((prev) => (prev ? `${prev}\n\n${extras.join(" ")}` : extras.join(" ")));
          }
        }
      }

      if (exportJobs.length === 0) {
        if (pending > 0) {
          setExportMessage(
            "No rows were written to the Excel file. Export excludes cancelled work except approved late cancellations.",
          );
        } else {
          setExportMessage(
            "No qualifying assignments in that date range. Cancelled work is excluded unless it is an approved late cancellation.",
          );
        }
        return;
      }
      if (reportKind === "customer_lead" && !exportJobs.some((j) => j.client)) {
        setExportMessage("No jobs with a linked client among exportable assignments in that range.");
        return;
      }
      await downloadReportExcel(reportKind, exportJobs, `${fromDate}_to_${toDate}`, {
        invoiceRange: { fromDate, toDate },
      });
      if (data.truncated) {
        setExportMessage(
          `Downloaded first ${jobs.length} exportable row(s) (limit reached). Narrow the date range to include more.`,
        );
      } else {
        const scope =
          reportKind === "invoice"
            ? `${exportJobs.length} billable assignment(s) (QuickBooks-style; one invoice per job code, rates from client profiles)`
            : reportKind === "bill"
              ? `${exportJobs.length} billable assignment(s) (QuickBooks-style; one bill per job code, rates from interpreter profiles)`
              : `${exportJobs.length} row(s) from exportable assignments`;
        setExportMessage(`Generated ${scope}.`);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      setExportError(typeof msg === "string" ? msg : "Could not generate export.");
    } finally {
      setExportLoading(false);
    }
  }

  const chartData = stats
    ? [
        { name: "Open", count: stats.jobs.open },
        { name: "Assigned", count: stats.jobs.assigned },
        { name: "Completed", count: stats.jobs.completed },
      ]
    : [];
  const total = stats ? stats.jobs.open + stats.jobs.assigned + stats.jobs.completed : 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Reports</h1>
          <p className={styles.lead}>Operational snapshot and downloadable billing exports</p>
        </div>
        <Link className={styles.assignmentsLink} to="/assignments">
          View assignments calendar
        </Link>
      </header>

      <section className={styles.exportCard} aria-label="Generate export">
        <h2 className={styles.cardTitle}>Generate export</h2>
        <p className={styles.exportLead}>
          Choose the appointment window (by scheduled start time), pick a report type, then download an
          Excel file. Cancelled appointments are omitted unless they are a late cancellation that a coordinator
          has approved. You will be alerted if anything in the window is still awaiting approval and not paid.
          Invoice export uses QuickBooks-style columns: one invoice per assignment (job code such as
          26T-0001), *Customer*, rates from each customer profile. Bill export matches that layout with
          *BillNo*, *Supplier* (interpreter), *BillDate*, and rates from each interpreter profile. Customer
          leads summarize each client from exportable jobs only.
        </p>
        <div className={styles.exportGrid}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>From</span>
            <LocalDateTimePicker
              className={styles.dateInput}
              withTime={false}
              value={fromDate}
              onChange={setFromDate}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>To</span>
            <LocalDateTimePicker
              className={styles.dateInput}
              withTime={false}
              value={toDate}
              onChange={setToDate}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Report type</span>
            <select
              className={styles.select}
              value={reportKind}
              onChange={(e) => setReportKind(e.target.value as ReportKind)}
            >
              <option value="invoice">Invoice (QuickBooks import layout)</option>
              <option value="bill">Bill (QuickBooks import layout)</option>
              <option value="customer_lead">Customer leads (per client)</option>
            </select>
          </label>
        </div>
        <div className={styles.exportActions}>
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={exportLoading}
            onClick={() => void generateExport()}
          >
            {exportLoading ? "Generating…" : "Download Excel"}
          </button>
          {exportLoading ? (
            <Oval height={28} width={28} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
          ) : null}
        </div>
        {exportError ? <p className={styles.bannerError}>{exportError}</p> : null}
        {exportWarning ? <p className={styles.bannerWarn}>{exportWarning}</p> : null}
        {exportMessage ? <p className={styles.bannerOk}>{exportMessage}</p> : null}
      </section>

      {statsLoading ? (
        <div className={styles.loader}>
          <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
        </div>
      ) : statsError ? (
        <p className={styles.error}>{statsError}</p>
      ) : stats ? (
        <>
          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total tracked jobs</span>
              <span className={styles.summaryValue}>{total}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Open</span>
              <span className={styles.summaryValue}>{stats.jobs.open}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Assigned</span>
              <span className={styles.summaryValue}>{stats.jobs.assigned}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Completed</span>
              <span className={styles.summaryValue}>{stats.jobs.completed}</span>
            </div>
          </div>

          <section className={styles.chartCard} aria-label="Jobs by status">
            <h2 className={styles.cardTitle}>Jobs by status</h2>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    stroke="var(--iiw-chart-axis)"
                    tick={{ fill: "var(--iiw-chart-tick)", fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--iiw-chart-axis)"
                    tick={{ fill: "var(--iiw-chart-tick)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--iiw-chart-tooltip-bg)",
                      border: "1px solid var(--iiw-chart-tooltip-border)",
                    }}
                    labelStyle={{ color: "var(--iiw-chart-tooltip-label)" }}
                  />
                  <Bar dataKey="count" fill={IIW_BLUE} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
