import { useEffect, useMemo, useState } from "react";
import { Oval } from "react-loader-spinner";
import { api } from "@/services/api/http-client";
import { getApiErrorMessage } from "@/utils/api-error-message";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import type { ExportableAssignment } from "@/features/assignments/assignmentExport";
import { AssignmentCard } from "@/features/assignments/ui/AssignmentCard";
import styles from "./OpenJobsPage.module.css";

export function OpenJobsPage() {
  const [jobs, setJobs] = useState<ExportableAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    api
      .get<ExportableAssignment[]>("/jobs")
      .then((r) => setJobs(r.data))
      .catch((err) => setError(getApiErrorMessage(err, "Could not load open jobs.")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const openForClaim = useMemo(() => jobs.filter((j) => j.status === "OPEN"), [jobs]);

  async function claim(id: number) {
    setActionId(id);
    setError(null);
    try {
      await api.post(`/jobs/${id}/claim`);
      load();
    } catch {
      setError("Could not claim this job.");
    } finally {
      setActionId(null);
    }
  }

  async function decline(id: number) {
    setActionId(id);
    setError(null);
    try {
      await api.post(`/jobs/${id}/decline`);
      load();
    } catch {
      setError("Could not decline this job.");
    } finally {
      setActionId(null);
    }
  }

  if (loading && jobs.length === 0) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Open jobs</h1>
          <p className={styles.lead}>Published assignments you can claim or decline — shown as cards</p>
        </div>
      </header>

      {error ? <p className={styles.bannerError}>{error}</p> : null}

      {openForClaim.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No open jobs right now</p>
          <p className={styles.emptyLead}>New requests will appear here when coordinators publish them.</p>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {openForClaim.map((j) => (
            <AssignmentCard
              key={j.id}
              job={j}
              variant="open"
              actionId={actionId}
              onClaim={claim}
              onDecline={decline}
            />
          ))}
        </div>
      )}
    </div>
  );
}
