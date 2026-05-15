import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { EventInput } from "@fullcalendar/core";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Link, useNavigate } from "react-router";
import { Oval } from "react-loader-spinner";
import { LocalDateTimePicker } from "@/components/datetime/LocalDateTimePicker";
import { pairEndAfterStartChange } from "@/components/datetime/localDateTimeFormat";
import { api } from "@/services/api/http-client";
import { getApiErrorMessage } from "@/utils/api-error-message";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { useAuth } from "@/features/auth/model/auth-context";
import {
  AssignmentScheduleFilters,
  getDefaultScheduleFilters,
  ScheduleFilterEmptyBanner,
} from "@/features/calendar/AssignmentScheduleFilters";
import { filterJobsForSchedule } from "@/features/calendar/jobScheduleSearch";
import { AssignmentStatusLegend } from "@/features/calendar/AssignmentStatusLegend";
import { calendarStyleForJobStatus } from "@/features/calendar/jobCalendarColors";
import type { ExportableAssignment } from "@/features/assignments/assignmentExport";
import { CalendarAssignmentModal } from "@/features/assignments/ui/CalendarAssignmentModal";
import styles from "./MySchedulePage.module.css";

type JobRow = ExportableAssignment;

type BusySlotRow = {
  id: number;
  startTime: string;
  endTime: string;
  reason: string | null;
};

type UnavailabilityPreset = "vacation" | "sick_leave" | "personal" | "other";

function presetToReason(preset: UnavailabilityPreset, otherDetail: string): string {
  switch (preset) {
    case "vacation":
      return "Vacation";
    case "sick_leave":
      return "Sick leave";
    case "personal":
      return "Personal / appointment";
    case "other":
      return otherDetail.trim() || "Unavailable";
    default:
      return "Unavailable";
  }
}

export function MySchedulePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [busySlots, setBusySlots] = useState<BusySlotRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(getDefaultScheduleFilters);
  const [previewJob, setPreviewJob] = useState<ExportableAssignment | null>(null);

  const [busyStart, setBusyStart] = useState("");
  const [busyEnd, setBusyEnd] = useState("");
  const [busyPreset, setBusyPreset] = useState<UnavailabilityPreset>("vacation");
  const [busyOther, setBusyOther] = useState("");
  const [busySaving, setBusySaving] = useState(false);
  const [busyFormError, setBusyFormError] = useState<string | null>(null);

  const reloadAll = useCallback(() => {
    return Promise.all([
      api.get<JobRow[]>("/jobs").then((r) => r.data),
      api.get<BusySlotRow[]>("/busy-slots").then((r) => r.data),
    ]).then(([jobData, busyData]) => {
      setJobs(jobData);
      setBusySlots(busyData);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reloadAll()
      .then(() => {
        if (!cancelled) setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "Could not load your schedule."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadAll]);

  const myJobs = useMemo(() => {
    if (!user?.id) return [];
    return jobs.filter((j) => j.interpreter?.id === user.id);
  }, [jobs, user?.id]);

  const filteredJobs = useMemo(() => filterJobsForSchedule(myJobs, filters), [myJobs, filters]);

  const busyEvents = useMemo<EventInput[]>(
    () =>
      busySlots.map((b) => ({
        id: `busy-${b.id}`,
        title: b.reason?.trim() ? `Unavailable · ${b.reason}` : "Unavailable",
        start: b.startTime,
        end: b.endTime,
        backgroundColor: "#64748b",
        borderColor: "#475569",
        textColor: "#f8fafc",
        extendedProps: { busySlot: b },
      })),
    [busySlots],
  );

  const jobEvents = useMemo<EventInput[]>(
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

  const events = useMemo<EventInput[]>(() => [...busyEvents, ...jobEvents], [busyEvents, jobEvents]);

  const showFilteredEmpty = myJobs.length > 0 && filteredJobs.length === 0;

  function handleBusyStartChange(next: string) {
    setBusyEnd((prevEnd) =>
      pairEndAfterStartChange({
        newStartStr: next,
        previousStartStr: busyStart.trim() ? busyStart : null,
        currentEndStr: prevEnd,
        durationHours: 2,
      }),
    );
    setBusyStart(next);
  }

  async function addBusyBlock(e: FormEvent) {
    e.preventDefault();
    if (!busyStart || !busyEnd) return;
    setBusySaving(true);
    setBusyFormError(null);
    try {
      const reason = presetToReason(busyPreset, busyOther);
      await api.post("/busy-slots", {
        startTime: new Date(busyStart).toISOString(),
        endTime: new Date(busyEnd).toISOString(),
        reason,
      });
      setBusyStart("");
      setBusyEnd("");
      setBusyPreset("vacation");
      setBusyOther("");
      await reloadAll();
    } catch (err) {
      setBusyFormError(getApiErrorMessage(err, "Could not save this block."));
    } finally {
      setBusySaving(false);
    }
  }

  async function removeBusySlot(id: number) {
    setError(null);
    try {
      await api.delete(`/busy-slots/${id}`);
      await reloadAll();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not remove that block."));
    }
  }

  if (loading && jobs.length === 0 && busySlots.length === 0) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  if (error && jobs.length === 0 && busySlots.length === 0) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>My schedule</h1>
          <p className={styles.lead}>
            Your assignments on the calendar, plus vacation, sick leave, or other unavailable times. When you are
            marked unavailable for a window that overlaps an open job, you will not receive the open-job email for that
            assignment (you can still use{" "}
            <Link to="/availability" className={styles.inlineLink}>
              Availability
            </Link>{" "}
            for the same blocks).
          </p>
        </div>
      </header>

      {error ? <p className={styles.bannerError}>{error}</p> : null}

      <AssignmentScheduleFilters
        jobsForOptions={myJobs}
        filters={filters}
        onFiltersChange={setFilters}
        showInterpreterFilter={false}
        idPrefix="my-schedule"
      />

      <div className={styles.calendarShell}>
        <ScheduleFilterEmptyBanner
          show={showFilteredEmpty}
          message="No jobs match your search or filters."
        />
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
            const props = info.event.extendedProps as {
              job?: ExportableAssignment;
              busySlot?: BusySlotRow;
            };
            if (props.job) {
              info.jsEvent.preventDefault();
              setPreviewJob(props.job);
              return;
            }
            if (props.busySlot) {
              info.jsEvent.preventDefault();
              const label = props.busySlot.reason?.trim() || "Unavailable";
              if (window.confirm(`Remove this unavailable time?\n\n${label}`)) {
                void removeBusySlot(props.busySlot.id);
              }
              return;
            }
            const id = info.event.id;
            if (id && !String(id).startsWith("busy-")) {
              navigate(`/jobs/${id}`);
            }
          }}
        />
      </div>

      <section className={styles.unavailableSection} aria-labelledby="unavailable-heading">
        <h2 id="unavailable-heading" className={styles.sectionTitle}>
          Unavailable time (vacation, sick leave, etc.)
        </h2>
        <p className={styles.sectionLead}>
          Blocks appear on your calendar in gray. Coordinators already see conflicts when assigning you; overlapping
          open jobs will not trigger the broadcast email to you.
        </p>
        <form className={styles.busyForm} onSubmit={addBusyBlock}>
          <label className={styles.busyLabel}>
            Type
            <select
              className={styles.busyInput}
              value={busyPreset}
              onChange={(ev) => setBusyPreset(ev.target.value as UnavailabilityPreset)}
            >
              <option value="vacation">Vacation</option>
              <option value="sick_leave">Sick leave</option>
              <option value="personal">Personal / appointment</option>
              <option value="other">Other (describe)</option>
            </select>
          </label>
          {busyPreset === "other" ? (
            <label className={`${styles.busyLabel} ${styles.busyLabelGrow}`}>
              Description
              <input
                className={styles.busyInput}
                value={busyOther}
                onChange={(ev) => setBusyOther(ev.target.value)}
                placeholder="e.g. Conference, jury duty"
                maxLength={400}
              />
            </label>
          ) : null}
          <label className={styles.busyLabel}>
            Start
            <LocalDateTimePicker
              className={styles.busyInput}
              value={busyStart}
              onChange={handleBusyStartChange}
              required
            />
          </label>
          <label className={styles.busyLabel}>
            End
            <LocalDateTimePicker className={styles.busyInput} value={busyEnd} onChange={setBusyEnd} required />
          </label>
          <div className={styles.busyActions}>
            <button className={styles.busySubmit} type="submit" disabled={busySaving}>
              {busySaving ? "Saving…" : "Add to calendar"}
            </button>
          </div>
        </form>
        {busyFormError ? <p className={styles.busyFormError}>{busyFormError}</p> : null}
      </section>

      <CalendarAssignmentModal job={previewJob} onClose={() => setPreviewJob(null)} />
    </div>
  );
}
