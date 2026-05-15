import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import type { ExportableAssignment } from "../assignmentExport";
import { assignmentsToCsv, downloadTextFile } from "../assignmentExport";
import { AssignmentCard } from "./AssignmentCard";
import styles from "./AssignmentsReportPage.module.css";

export type AssignmentReportJob = ExportableAssignment;

export type AssignmentsReportLocationState = {
  jobs: AssignmentReportJob[];
  filterSummary: string;
};

function isReportState(x: unknown): x is AssignmentsReportLocationState {
  return (
    typeof x === "object" &&
    x !== null &&
    "jobs" in x &&
    Array.isArray((x as AssignmentsReportLocationState).jobs)
  );
}

export function AssignmentsReportPage() {
  const location = useLocation();

  const [jobs, setJobs] = useState<AssignmentReportJob[]>([]);
  const [filterSummary, setFilterSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isReportState(location.state)) {
      setJobs(location.state.jobs);
      setFilterSummary(location.state.filterSummary ?? "");
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    api
      .get<AssignmentReportJob[]>("/jobs")
      .then((r) => {
        setJobs(r.data);
        setFilterSummary("All assignments (open this report from Assignments with “Print report” to match your filters)");
      })
      .catch(() => setError("Could not load assignments for this report."))
      .finally(() => setLoading(false));
  }, [location.state, location.key]);

  const sorted = useMemo(
    () => [...jobs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [jobs],
  );

  const generatedAt = useMemo(() => new Date().toLocaleString(), []);

  function handlePrint() {
    window.print();
  }

  function handleDownloadCsv() {
    const csv = assignmentsToCsv(sorted);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`assignments-report-${stamp}.csv`, csv);
  }

  if (loading) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error}</p>
        <Link to="/assignments" className={styles.backLink}>
          Back to assignments
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.screenOnly}>
        <div className={styles.actions}>
          <button type="button" className={styles.printBtn} onClick={handlePrint}>
            Print / Save as PDF
          </button>
          <button type="button" className={styles.downloadBtn} onClick={handleDownloadCsv}>
            Download CSV
          </button>
          <Link to="/assignments" className={styles.backLink}>
            Back to assignments
          </Link>
        </div>
        <p className={styles.screenHint}>
          Use your browser’s print dialog and choose <strong>Save as PDF</strong> to download a PDF. CSV includes the same
          rows as the cards below.
        </p>
      </div>

      <header className={styles.reportHeader}>
        <h1 className={styles.reportTitle}>Assignments report</h1>
        <p className={styles.meta}>Generated {generatedAt}</p>
        <p className={styles.meta}>{filterSummary}</p>
        <p className={styles.count}>{sorted.length} record(s)</p>
      </header>

      {sorted.length === 0 ? (
        <p className={styles.empty}>No assignments in this report.</p>
      ) : (
        <div className={styles.cardGrid}>
          {sorted.map((j) => (
            <AssignmentCard key={j.id} job={j} />
          ))}
        </div>
      )}

      <footer className={styles.reportFooter}>
        <span>InterpreterHub — Assignments</span>
      </footer>
    </div>
  );
}
