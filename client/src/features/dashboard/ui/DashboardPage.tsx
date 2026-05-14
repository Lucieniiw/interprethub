import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { isAxiosError } from "axios";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Oval } from "react-loader-spinner";
import { api } from "@/services/api/http-client";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import styles from "./DashboardPage.module.css";

const DASHBOARD_ACTIVITY_PREVIEW = 5;

type Overview = {
  assignments: { total: number };
  jobs: {
    open: number;
    assigned: number;
    completed: number;
    cancelled: number;
    paid: number;
  };
  declines: { logged: number };
  linguists: { active: number };
  clients: { activeWithJobs: number };
  topClients: Array<{ clientId: number; name: string; jobCount: number }>;
  topLinguists: Array<{ interpreterId: number; name: string; assignmentCount: number }>;
  recentActivity: Array<{
    id: number;
    type: string;
    message: string;
    createdAt: string;
    userName: string | null;
  }>;
};

function parseOverview(raw: unknown): Overview | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const assignments = o.assignments && typeof o.assignments === "object" ? (o.assignments as { total?: unknown }).total : undefined;
  const jobs = o.jobs && typeof o.jobs === "object" ? (o.jobs as Record<string, unknown>) : {};
  const declines = o.declines && typeof o.declines === "object" ? (o.declines as { logged?: unknown }).logged : undefined;
  const linguists = o.linguists && typeof o.linguists === "object" ? (o.linguists as { active?: unknown }).active : undefined;
  const clients = o.clients && typeof o.clients === "object" ? (o.clients as { activeWithJobs?: unknown }).activeWithJobs : undefined;

  const topClients = Array.isArray(o.topClients)
    ? o.topClients.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          clientId: num(r.clientId),
          name: typeof r.name === "string" ? r.name : "",
          jobCount: num(r.jobCount),
        };
      })
    : [];

  const topLinguists = Array.isArray(o.topLinguists)
    ? o.topLinguists.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          interpreterId: num(r.interpreterId),
          name: typeof r.name === "string" ? r.name : "",
          assignmentCount: num(r.assignmentCount),
        };
      })
    : [];

  const recentActivity = Array.isArray(o.recentActivity)
    ? o.recentActivity.map((row, i) => {
        const r = row as Record<string, unknown>;
        return {
          id: typeof r.id === "number" ? r.id : i,
          type: typeof r.type === "string" ? r.type : "",
          message: typeof r.message === "string" ? r.message : "",
          createdAt: typeof r.createdAt === "string" ? r.createdAt : "",
          userName: typeof r.userName === "string" || r.userName === null ? (r.userName as string | null) : null,
        };
      })
    : [];

  return {
    assignments: { total: num(assignments) },
    jobs: {
      open: num(jobs.open),
      assigned: num(jobs.assigned),
      completed: num(jobs.completed),
      cancelled: num(jobs.cancelled),
      paid: num(jobs.paid),
    },
    declines: { logged: num(declines) },
    linguists: { active: num(linguists) },
    clients: { activeWithJobs: num(clients) },
    topClients,
    topLinguists,
    recentActivity,
  };
}

export function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/api/dashboard/overview")
      .then((r) => {
        const parsed = parseOverview(r.data);
        if (!parsed) {
          setError("Unexpected response from the server.");
          return;
        }
        setData(parsed);
      })
      .catch((err: unknown) => {
        if (isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 403) {
            setError("Coordinator access is required for this dashboard.");
            return;
          }
          if (status === 404) {
            setError(
              "Dashboard API was not found. Ensure the API app is updated and running (GET /api/dashboard/overview).",
            );
            return;
          }
          const body = err.response?.data;
          const apiErr =
            body && typeof body === "object" && "error" in body ? String((body as { error?: string }).error) : null;
          setError(apiErr || err.message || "Could not load dashboard.");
          return;
        }
        setError("Could not load dashboard.");
      });
  }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Open", count: data.jobs.open },
      { name: "Assigned", count: data.jobs.assigned },
      { name: "Completed", count: data.jobs.completed },
      { name: "Cancelled", count: data.jobs.cancelled },
      { name: "Paid", count: data.jobs.paid },
    ];
  }, [data]);

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (!data) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  const topClient = data.topClients[0];
  const topLinguist = data.topLinguists[0];
  const activityPreview = data.recentActivity.slice(0, DASHBOARD_ACTIVITY_PREVIEW);

  return (
    <div className={styles.page}>
      <div className={styles.stickyPageHead}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.lead}>Operational overview — assignments, pipeline, linguists, clients, and activity</p>
          </div>
        </header>
      </div>

      <section className={styles.overview} aria-label="Operations summary">
        <p className={styles.overviewText}>
          You have <strong>{data.assignments.total}</strong> assignment{data.assignments.total === 1 ? "" : "s"} on record.
          The pipeline shows <strong>{data.jobs.open}</strong> open, <strong>{data.jobs.assigned}</strong> assigned, and{" "}
          <strong>{data.jobs.completed}</strong> completed jobs. Linguists have logged <strong>{data.declines.logged}</strong>{" "}
          decline{data.declines.logged === 1 ? "" : "s"} on open work. There are <strong>{data.linguists.active}</strong>{" "}
          active linguist{data.linguists.active === 1 ? "" : "s"} and <strong>{data.clients.activeWithJobs}</strong> client
          {data.clients.activeWithJobs === 1 ? "" : "s"} with at least one job.
        </p>
      </section>

      <section className={styles.kpiGrid} aria-label="Key metrics">
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Assignments</span>
          <span className={styles.kpiValue}>{data.assignments.total}</span>
          <span className={styles.kpiHint}>Total jobs</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Open</span>
          <span className={styles.kpiValue}>{data.jobs.open}</span>
          <span className={styles.kpiHint}>Awaiting claim</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Assigned</span>
          <span className={styles.kpiValue}>{data.jobs.assigned}</span>
          <span className={styles.kpiHint}>In progress</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Declined</span>
          <span className={styles.kpiValue}>{data.declines.logged}</span>
          <span className={styles.kpiHint}>Decline actions</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Completed</span>
          <span className={styles.kpiValue}>{data.jobs.completed}</span>
          <span className={styles.kpiHint}>Finished work</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Active linguists</span>
          <span className={styles.kpiValue}>{data.linguists.active}</span>
          <span className={styles.kpiHint}>Status active</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>Active clients</span>
          <span className={styles.kpiValue}>{data.clients.activeWithJobs}</span>
          <span className={styles.kpiHint}>With jobs</span>
        </div>
      </section>

      <section className={styles.chartCard} aria-label="Jobs by status">
        <h2 className={styles.cardTitle}>Assignments by status</h2>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis allowDecimals={false} stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ background: "#121820", border: "1px solid rgba(255,255,255,0.08)" }}
                labelStyle={{ color: "#e8ecf1" }}
              />
              <Bar dataKey="count" fill={IIW_BLUE} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className={styles.leadersRow}>
        <section className={styles.leaderCard} aria-label="Top client by requests">
          <h2 className={styles.cardTitle}>Top client by requests</h2>
          {topClient ? (
            <>
              <div className={styles.leaderHero}>
                <span className={styles.leaderRank}>#1</span>
                <div>
                  <div className={styles.leaderName}>{topClient.name}</div>
                  <div className={styles.leaderStat}>{topClient.jobCount} job requests</div>
                </div>
              </div>
              {data.topClients.length > 1 ? (
                <ol className={styles.leaderList}>
                  {data.topClients.slice(1).map((c, idx) => (
                    <li key={c.clientId}>
                      <span className={styles.leaderListRank}>{idx + 2}</span>
                      <span className={styles.leaderListName}>{c.name}</span>
                      <span className={styles.leaderListCount}>{c.jobCount}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.leaderEmpty}>No other clients ranked yet.</p>
              )}
            </>
          ) : (
            <p className={styles.leaderEmpty}>No client-linked jobs yet.</p>
          )}
        </section>

        <section className={styles.leaderCard} aria-label="Top linguist by assignments">
          <h2 className={styles.cardTitle}>Top linguist by assignments</h2>
          {topLinguist ? (
            <>
              <div className={styles.leaderHero}>
                <span className={styles.leaderRank}>#1</span>
                <div>
                  <div className={styles.leaderName}>{topLinguist.name}</div>
                  <div className={styles.leaderStat}>{topLinguist.assignmentCount} assignments held</div>
                </div>
              </div>
              {data.topLinguists.length > 1 ? (
                <ol className={styles.leaderList}>
                  {data.topLinguists.slice(1).map((u, idx) => (
                    <li key={u.interpreterId}>
                      <span className={styles.leaderListRank}>{idx + 2}</span>
                      <span className={styles.leaderListName}>{u.name}</span>
                      <span className={styles.leaderListCount}>{u.assignmentCount}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.leaderEmpty}>No other linguists ranked yet.</p>
              )}
            </>
          ) : (
            <p className={styles.leaderEmpty}>No assigned jobs yet.</p>
          )}
        </section>
      </div>

      <section className={styles.activitySection} aria-label="Recent activity">
        <div className={styles.activityHead}>
          <h2 className={styles.cardTitle}>Recent activity</h2>
          <Link className={styles.activityLink} to="/activity">
            View all
          </Link>
        </div>
        {activityPreview.length === 0 ? (
          <p className={styles.leaderEmpty}>No activity logged yet.</p>
        ) : (
          <>
            <ul className={styles.activityList}>
              {activityPreview.map((a) => (
                <li key={a.id} className={styles.activityItem}>
                  <div className={styles.activityMeta}>
                    <time dateTime={a.createdAt}>
                      {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                    </time>
                    {a.userName ? <span className={styles.activityUser}>{a.userName}</span> : null}
                    <span className={styles.activityType}>{a.type}</span>
                  </div>
                  <p className={styles.activityMessage}>{a.message}</p>
                </li>
              ))}
            </ul>
            {data.recentActivity.length >= DASHBOARD_ACTIVITY_PREVIEW ? (
              <p className={styles.activityFooter}>
                Showing the latest {DASHBOARD_ACTIVITY_PREVIEW} entries.{" "}
                <Link className={styles.activityLink} to="/activity">
                  View all activity
                </Link>
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
