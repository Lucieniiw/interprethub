import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Link, useNavigate } from "react-router";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import {
  AssignmentScheduleFilters,
  getDefaultScheduleFilters,
  type ScheduleFilterState,
  ScheduleFilterEmptyBanner,
} from "@/features/calendar/AssignmentScheduleFilters";
import { filterJobsForSchedule } from "@/features/calendar/jobScheduleSearch";
import { api } from "@/services/api/http-client";
import { getApiErrorMessage } from "@/utils/api-error-message";
import { useAuth } from "@/features/auth/model/auth-context";
import { AssignmentStatusLegend } from "@/features/calendar/AssignmentStatusLegend";
import { calendarStyleForJobStatus } from "@/features/calendar/jobCalendarColors";
import type { ExportableAssignment } from "@/features/assignments/assignmentExport";
import { AssignmentCard } from "./AssignmentCard";
import { CalendarAssignmentModal } from "./CalendarAssignmentModal";
import { createAuthenticatedSocket } from "@/services/api/socket";
import styles from "./AssignmentsPage.module.css";

function buildAssignmentFilterSummary(
  filters: ScheduleFilterState,
  jobs: ExportableAssignment[],
  includedCount: number,
): string {
  const parts: string[] = [];
  if (filters.search.trim()) {
    parts.push(`Search: "${filters.search.trim()}"`);
  }
  if (filters.status) {
    const labels: Record<string, string> = {
      OPEN: "Open",
      ASSIGNED: "Assigned",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
      PAID: "Paid",
    };
    parts.push(`Status: ${labels[filters.status] ?? filters.status}`);
  }
  if (filters.clientId) {
    const id = Number(filters.clientId);
    const name = jobs.find((j) => j.client?.id === id)?.client?.name;
    parts.push(`Client: ${name ?? `#${id}`}`);
  }
  if (filters.interpreterId) {
    const id = Number(filters.interpreterId);
    const name = jobs.find((j) => j.interpreter?.id === id)?.interpreter?.name;
    parts.push(`Interpreter: ${name ?? `#${id}`}`);
  }
  parts.push(`${includedCount} assignment(s)`);
  return parts.join(" · ");
}

/** Interpreters: cards | calendar. Coordinators: calendar | submissions (pending review only). */
type ViewMode = "cards" | "calendar" | "submissions";

export function AssignmentsPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const isInterpreter = user?.role === "INTERPRETER";
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [jobs, setJobs] = useState<ExportableAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [filters, setFilters] = useState(getDefaultScheduleFilters);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [previewJob, setPreviewJob] = useState<ExportableAssignment | null>(null);
  const staffCalendarDefaulted = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<ExportableAssignment[]>("/jobs")
      .then((r) => setJobs(r.data))
      .catch((err) => setError(getApiErrorMessage(err, "Could not load assignments.")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Coordinators land on the calendar once; tab choice is preserved afterward. */
  useEffect(() => {
    if (staffCalendarDefaulted.current) return;
    if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
      staffCalendarDefaulted.current = true;
      setViewMode("calendar");
    }
  }, [user?.role]);

  useEffect(() => {
    if (!isStaff || !token) return;
    const socket = createAuthenticatedSocket(token);
    socket.on("job:updated", () => {
      void load();
    });
    return () => {
      socket.off("job:updated");
      socket.disconnect();
    };
  }, [isStaff, token, load]);

  const filteredJobs = useMemo(() => filterJobsForSchedule(jobs, filters), [jobs, filters]);

  const sortedFiltered = useMemo(
    () => [...filteredJobs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [filteredJobs],
  );

  const openForClaim = useMemo(
    () => (isInterpreter ? filteredJobs.filter((j) => j.status === "OPEN") : []),
    [filteredJobs, isInterpreter],
  );

  /** Coordinator queue: interpreter-submitted completions awaiting approval (not open/unassigned jobs). */
  const pendingReviewJobs = useMemo(
    () =>
      [...jobs]
        .filter((j) => j.completionStatus === "PENDING_REVIEW")
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [jobs],
  );
  const pendingSubmissionCount = pendingReviewJobs.length;

  const pendingInterpretationReviews = useMemo(
    () => pendingReviewJobs.filter((j) => j.serviceCategory === "INTERPRETATION"),
    [pendingReviewJobs],
  );
  const pendingTranslationReviews = useMemo(
    () => pendingReviewJobs.filter((j) => j.serviceCategory === "TRANSLATION"),
    [pendingReviewJobs],
  );

  async function claim(id: number) {
    setActionId(id);
    setError(null);
    try {
      await api.post(`/jobs/${id}/claim`);
      load();
    } catch {
      setError("Could not claim this assignment.");
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
      setError("Could not decline this assignment.");
    } finally {
      setActionId(null);
    }
  }

  const events = useMemo<EventInput[]>(
    () =>
      filteredJobs.map((j) => {
        const colors = calendarStyleForJobStatus(j.status);
        return {
          id: String(j.id),
          title:
            j.serviceCategory === "TRANSLATION" && j.targetLanguage
              ? `${j.language} → ${j.targetLanguage} · ${j.status}`
              : `${j.language} · ${j.status}${j.location ? ` · ${j.location}` : ""}`,
          start: j.startTime,
          end: j.endTime,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          textColor: colors.textColor,
          extendedProps: { job: j },
        };
      }),
    [filteredJobs],
  );

  const showFilteredEmpty = jobs.length > 0 && filteredJobs.length === 0;

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
          <h1 className={styles.title}>Assignments</h1>
          <p className={styles.lead}>
            {isStaff
              ? "Calendar is your home view. Open Submissions to review interpreter paperwork that is waiting on you — once approved, it leaves that list but stays on the calendar; open any event to print."
              : "Browse as cards or switch to the week calendar; print your filtered list from Print report."}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() =>
              navigate("/assignments/report", {
                state: {
                  jobs: filteredJobs,
                  filterSummary: buildAssignmentFilterSummary(filters, jobs, filteredJobs.length),
                },
              })
            }
          >
            Print report
          </button>
          {isStaff ? (
            <Link className={styles.newJob} to="/jobs/new">
              New assignment
            </Link>
          ) : null}
        </div>
      </header>

      {error ? <p className={styles.bannerError}>{error}</p> : null}

      <AssignmentScheduleFilters
        jobsForOptions={jobs}
        filters={filters}
        onFiltersChange={setFilters}
        showInterpreterFilter={isStaff}
        idPrefix="assignments"
      />

      <div
        className={styles.viewTabs}
        role="tablist"
        aria-label={isStaff ? "Assignments layout" : "Assignments view"}
      >
        {isStaff ? (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode !== "submissions"}
              className={`${styles.viewTab} ${viewMode !== "submissions" ? styles.viewTabActive : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "submissions"}
              className={`${styles.viewTab} ${viewMode === "submissions" ? styles.viewTabActive : ""}`}
              onClick={() => setViewMode("submissions")}
            >
              Submissions
              {pendingSubmissionCount > 0 ? (
                <span className={styles.tabBadge} aria-hidden>
                  {pendingSubmissionCount > 9 ? "9+" : pendingSubmissionCount}
                </span>
              ) : null}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "cards"}
              className={`${styles.viewTab} ${viewMode === "cards" ? styles.viewTabActive : ""}`}
              onClick={() => setViewMode("cards")}
            >
              Cards
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "calendar"}
              className={`${styles.viewTab} ${viewMode === "calendar" ? styles.viewTabActive : ""}`}
              onClick={() => setViewMode("calendar")}
            >
              Calendar
            </button>
          </>
        )}
      </div>

      {isInterpreter && openForClaim.length > 0 ? (
        <section className={styles.openSection} aria-label="Open work">
          <h2 className={styles.sectionTitle}>Open work you can take</h2>
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
        </section>
      ) : null}

      {isStaff && viewMode === "submissions" ? (
        <section className={styles.listSection} aria-label="Submissions pending coordinator review">
          <div className={styles.listSectionHead}>
            <h2 className={styles.submissionsPageTitle}>
              <span>Submissions</span>
              {pendingSubmissionCount > 0 ? (
                <span className={styles.queueBadge} aria-live="polite">
                  {pendingSubmissionCount > 9 ? "9+" : pendingSubmissionCount}
                </span>
              ) : null}
            </h2>
          </div>
          <p className={styles.submissionsLead}>
            Only paperwork submitted by a linguist and waiting for your review — split by service type. When you
            approve, an item leaves this tab but stays on the Calendar; open an event or job details to print.
          </p>
          {pendingReviewJobs.length === 0 ? (
            <p className={styles.submissionsEmpty}>No submissions awaiting review.</p>
          ) : (
            <>
              <div className={styles.submissionGroup}>
                <h3 className={styles.submissionGroupTitle}>
                  <span>Interpretation</span>
                  {pendingInterpretationReviews.length > 0 ? (
                    <span className={styles.submissionGroupCount}>{pendingInterpretationReviews.length}</span>
                  ) : null}
                </h3>
                {pendingInterpretationReviews.length === 0 ? (
                  <p className={styles.submissionsEmpty}>No interpretation submissions pending.</p>
                ) : (
                  <div className={styles.cardGrid}>
                    {pendingInterpretationReviews.map((j) => (
                      <AssignmentCard key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.submissionGroup}>
                <h3 className={styles.submissionGroupTitle}>
                  <span>Translation</span>
                  {pendingTranslationReviews.length > 0 ? (
                    <span className={styles.submissionGroupCount}>{pendingTranslationReviews.length}</span>
                  ) : null}
                </h3>
                {pendingTranslationReviews.length === 0 ? (
                  <p className={styles.submissionsEmpty}>No translation submissions pending.</p>
                ) : (
                  <div className={styles.cardGrid}>
                    {pendingTranslationReviews.map((j) => (
                      <AssignmentCard key={j.id} job={j} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      ) : isStaff ? (
        <div className={styles.calendarShell}>
          <ScheduleFilterEmptyBanner show={showFilteredEmpty} />
          <AssignmentStatusLegend />
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            height="auto"
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            events={events}
            nowIndicator
            eventClick={(info) => {
              const raw = info.event.extendedProps as { job?: ExportableAssignment };
              if (raw.job) {
                info.jsEvent.preventDefault();
                setPreviewJob(raw.job);
              } else if (info.event.id) {
                navigate(`/jobs/${info.event.id}`);
              }
            }}
          />
        </div>
      ) : viewMode === "cards" ? (
        <section className={styles.listSection} aria-label="Filtered assignments">
          <div className={styles.listSectionHead}>
            <h2 className={styles.sectionTitle}>Assignments ({sortedFiltered.length})</h2>
          </div>
          <ScheduleFilterEmptyBanner show={showFilteredEmpty} />
          {!showFilteredEmpty ? (
            <div className={styles.cardGrid}>
              {sortedFiltered.map((j) => (
                <AssignmentCard key={j.id} job={j} />
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <div className={styles.calendarShell}>
          <ScheduleFilterEmptyBanner show={showFilteredEmpty} />
          <AssignmentStatusLegend />
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            height="auto"
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            events={events}
            nowIndicator
            eventClick={(info) => {
              const raw = info.event.extendedProps as { job?: ExportableAssignment };
              if (raw.job) {
                info.jsEvent.preventDefault();
                setPreviewJob(raw.job);
              } else if (info.event.id) {
                navigate(`/jobs/${info.event.id}`);
              }
            }}
          />
        </div>
      )}
      <CalendarAssignmentModal job={previewJob} onClose={() => setPreviewJob(null)} />
    </div>
  );
}
