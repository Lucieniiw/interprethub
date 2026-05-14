import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Oval } from "react-loader-spinner";
import { isAxiosError } from "axios";
import SignatureCanvas from "react-signature-canvas";
import {
  computeInterpretationPayBreakdown,
  computeTranslationPayBreakdown,
  formatJobReference,
  type InterpretationPayInput,
} from "@interpret-hub/shared";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import { useAuth } from "@/features/auth/model/auth-context";
import { resolveUploadUrl } from "@/utils/resolve-upload-url";
import { LocalDateTimePicker } from "@/components/datetime/LocalDateTimePicker";
import { pairEndAfterStartChange } from "@/components/datetime/localDateTimeFormat";
import { JobFormPrintStyleTag, JobTailwindFormSheet } from "./JobTailwindFormSheet";
import { JobStatusStepper } from "./JobStatusStepper";
import styles from "./JobDetailPage.module.css";

type JobDetail = {
  id: number;
  jobCode: string | null;
  status: string;
  operationalStatus?: string;
  billingStatus?: string;
  language: string;
  targetLanguage: string | null;
  serviceType: string;
  serviceCategory: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | null;
  location: string | null;
  notes: string | null;
  rate: number;
  interpreterId: number | null;
  clientId: number | null;
  requesterEmail?: string | null;
  requesterName: string | null;
  recipientName: string | null;
  interpretationType: string | null;
  translationDueDate: string | null;
  translationClientName: string | null;
  rushFee: number | null;
  attachmentUrl: string | null;
  completionStatus: string;
  completionDisputeNote: string | null;
  completionNotes: string | null;
  interpreterStartTime: string | null;
  interpreterEndTime: string | null;
  interpreterMileage: number | null;
  interpreterTravelTime: number | null;
  interpreterNotes: string | null;
  interpreterSignature: string | null;
  staffName: string | null;
  staffSignature: string | null;
  interpreterSessionOutcome: string | null;
  interpreterTravelOutsideCounty: boolean | null;
  client: { id: number; name: string; address?: string | null } | null;
  patientName: string | null;
  interpreter: {
    id: number;
    name: string;
    email: string;
    interpreterProfile?: {
      rateInPerson: number;
      rateVirtual: number;
      ratePhone: number;
      rateMileage: number;
      rateTravelTime: number;
    } | null;
  } | null;
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function modalityLabel(code: string): string {
  switch (code) {
    case "IN_PERSON":
      return "In person";
    case "VIRTUAL":
      return "Virtual";
    case "PHONE":
      return "Phone";
    default:
      return code;
  }
}

function domainLabel(code: string | null): string {
  switch (code) {
    case "IMMIGRATION":
      return "Immigration";
    case "MEDICAL":
      return "Medical";
    case "SOCIAL_SERVICES":
      return "Social services";
    case "OTHER":
      return "Other";
    default:
      return code?.trim() ? code : "—";
  }
}

function completionStatusLabel(code: string): string {
  switch (code) {
    case "NONE":
      return "Not submitted";
    case "PENDING_REVIEW":
      return "Awaiting coordinator review";
    case "APPROVED":
      return "Approved";
    case "DISPUTED":
      return "Disputed — interpreter may resubmit";
    default:
      return code;
  }
}

function displayLocalDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

/** Consumer / beneficiary name for completion report and summaries. */
function consumerDisplayName(job: JobDetail): string {
  if (job.serviceCategory === "TRANSLATION") {
    return job.translationClientName?.trim() || job.patientName?.trim() || job.recipientName?.trim() || "—";
  }
  return job.recipientName?.trim() || job.patientName?.trim() || "—";
}

function jobAddressLine(job: JobDetail): string {
  const clientAddr = job.client?.address?.trim();
  if (clientAddr) return clientAddr;
  const loc = job.location?.trim();
  return loc || "—";
}

function LinguistPayBreakdownBlock({ job }: { job: JobDetail }) {
  const isInterp = job.serviceCategory === "INTERPRETATION";
  const profileRow = job.interpreter?.interpreterProfile;
  const profile = profileRow
    ? {
        rateInPerson: profileRow.rateInPerson,
        rateVirtual: profileRow.rateVirtual,
        ratePhone: profileRow.ratePhone,
        rateMileage: profileRow.rateMileage,
        rateTravelTime: profileRow.rateTravelTime,
      }
    : null;

  const translationPay = !isInterp ? computeTranslationPayBreakdown(job.rate, job.rushFee) : null;

  let interpPay: ReturnType<typeof computeInterpretationPayBreakdown> | null = null;
  if (isInterp) {
    const outcome =
      job.interpreterSessionOutcome === "LATE_CANCELLATION"
        ? "LATE_CANCELLATION"
        : job.interpreterSessionOutcome === "COMPLETED_SESSION"
          ? "COMPLETED_SESSION"
          : null;
    const payInput: InterpretationPayInput = {
      serviceType: job.serviceType as InterpretationPayInput["serviceType"],
      interpreterSessionOutcome: outcome,
      interpreterStartTime: job.interpreterStartTime,
      interpreterEndTime: job.interpreterEndTime,
      durationMinutes: job.durationMinutes,
      scheduledStartTime: job.startTime,
      scheduledEndTime: job.endTime,
      interpreterMileage: job.interpreterMileage,
      interpreterTravelTime: job.interpreterTravelTime,
      interpreterTravelOutsideCounty: job.interpreterTravelOutsideCounty,
    };
    interpPay = computeInterpretationPayBreakdown(profile, payInput);
  }

  return (
    <div className={styles.detailsPayBreakdown}>
      <h3 className={styles.reportMoneyTitle}>Pay breakdown (linguist profile)</h3>
      {!profile ? (
        <p className={styles.help}>No interpreter pay profile on file — rates default to $0 until staff set them.</p>
      ) : null}

      {isInterp && interpPay ? (
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Service ({modalityLabel(job.serviceType)})</td>
              <td>
                {interpPay.billableSessionHours != null ? `${interpPay.billableSessionHours.toFixed(2)} h` : "—"}
              </td>
              <td>${interpPay.hourlyRate.toFixed(2)}/h</td>
              <td>${interpPay.serviceUsd.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Mileage</td>
              <td>{interpPay.miles.toFixed(1)} mi</td>
              <td>${interpPay.mileageRate.toFixed(2)}/mi</td>
              <td>${interpPay.mileageUsd.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Travel time</td>
              <td>{interpPay.travelMinutes > 0 ? `${interpPay.travelHours.toFixed(2)} h` : "—"}</td>
              <td>${interpPay.travelRatePerHour.toFixed(2)}/h</td>
              <td>${interpPay.travelUsd.toFixed(2)}</td>
            </tr>
            <tr className={styles.reportTotalRow}>
              <td colSpan={3}>
                <strong>Estimated linguist pay</strong>
              </td>
              <td>
                <strong>${interpPay.totalUsd.toFixed(2)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}

      {!isInterp && translationPay ? (
        <table className={styles.reportTable}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Translation flat</td>
              <td>1 job</td>
              <td>—</td>
              <td>${translationPay.flatUsd.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Rush fee</td>
              <td>—</td>
              <td>—</td>
              <td>${translationPay.rushUsd.toFixed(2)}</td>
            </tr>
            <tr className={styles.reportTotalRow}>
              <td colSpan={3}>
                <strong>Estimated linguist pay</strong>
              </td>
              <td>
                <strong>${translationPay.totalUsd.toFixed(2)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function JobReadonlyDetailsCard({
  job,
  isStaff,
  mine,
  onPrintIiw,
  showLinguistPay,
}: {
  job: JobDetail;
  isStaff: boolean;
  mine: boolean;
  onPrintIiw: () => void;
  showLinguistPay?: boolean;
}) {
  const isInterp = job.serviceCategory === "INTERPRETATION";
  const isTrans = job.serviceCategory === "TRANSLATION";
  const showBilling = isStaff && !mine;

  return (
    <section className={`${styles.card} ${styles.screenOnly}`} aria-labelledby="job-details-heading">
      <div className={styles.detailsCardHead}>
        <h2 id="job-details-heading" className={styles.h2}>
          Details
        </h2>
        <div className={styles.detailsPrintActions}>
          <Link
            to={`/jobs/${job.id}/form`}
            className={styles.secondary}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open worksheet
          </Link>
          <button type="button" className={styles.secondary} onClick={onPrintIiw}>
            Print IIW job form
          </button>
        </div>
      </div>
      <dl className={styles.dl}>
        <dt>Reference</dt>
        <dd>{formatJobReference(job)}</dd>
        <dt>Status</dt>
        <dd>{job.status}</dd>
        {job.operationalStatus ? (
          <>
            <dt>Operational</dt>
            <dd>{job.operationalStatus}</dd>
          </>
        ) : null}
        <dt>Category</dt>
        <dd>{job.serviceCategory}</dd>
        {isInterp ? (
          <>
            <dt>Modality</dt>
            <dd>{modalityLabel(job.serviceType)}</dd>
            <dt>Domain</dt>
            <dd>{domainLabel(job.interpretationType)}</dd>
          </>
        ) : null}
        <dt>Language</dt>
        <dd>{job.language}</dd>
        {isTrans ? (
          <>
            <dt>Target language</dt>
            <dd>{job.targetLanguage ?? "—"}</dd>
            <dt>Translation due</dt>
            <dd>{job.translationDueDate ? displayLocalDateTime(job.translationDueDate) : "—"}</dd>
            <dt>Translation client</dt>
            <dd>{job.translationClientName ?? "—"}</dd>
            <dt>Rush fee</dt>
            <dd>{job.rushFee != null && job.rushFee > 0 ? `$${job.rushFee.toFixed(2)}` : "—"}</dd>
          </>
        ) : null}
        <dt>Client</dt>
        <dd>{job.client?.name ?? "—"}</dd>
        <dt>Location</dt>
        <dd>{job.location?.trim() ? job.location : "—"}</dd>
        <dt>Interpreter</dt>
        <dd>{job.interpreter?.name ?? "Unassigned"}</dd>
        <dt>Scheduled start</dt>
        <dd>{displayLocalDateTime(job.startTime)}</dd>
        <dt>Scheduled end</dt>
        <dd>{displayLocalDateTime(job.endTime)}</dd>
        {showBilling ? (
          <>
            <dt>Rate</dt>
            <dd>${job.rate.toFixed(2)}</dd>
            <dt>Completion</dt>
            <dd>{completionStatusLabel(job.completionStatus)}</dd>
          </>
        ) : null}
        {isInterp ? (
          <>
            <dt>Consumer / recipient</dt>
            <dd>{job.recipientName ?? "—"}</dd>
          </>
        ) : null}
        <dt>Requester</dt>
        <dd>{job.requesterName ?? "—"}</dd>
        <dt>Requester email</dt>
        <dd>{job.requesterEmail?.trim() ? job.requesterEmail : "—"}</dd>
        <dt>Internal notes</dt>
        <dd>{job.notes?.trim() ? job.notes : "—"}</dd>
        <dt>Attachment</dt>
        <dd>
          {job.attachmentUrl ? (
            <a href={resolveUploadUrl(job.attachmentUrl) ?? "#"} target="_blank" rel="noopener noreferrer">
              Open / download
            </a>
          ) : (
            "—"
          )}
        </dd>
        {job.interpreterStartTime || job.interpreterEndTime ? (
          <>
            <dt>Reported session start</dt>
            <dd>{displayLocalDateTime(job.interpreterStartTime)}</dd>
            <dt>Reported session end</dt>
            <dd>{displayLocalDateTime(job.interpreterEndTime)}</dd>
          </>
        ) : null}
      </dl>
      {showLinguistPay ? <LinguistPayBreakdownBlock job={job} /> : null}
    </section>
  );
}

type SessionOutcome = "COMPLETED_SESSION" | "LATE_CANCELLATION" | "";

function sessionHoursFromLocal(start: string, end: string): number | null {
  if (!start.trim() || !end.trim()) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return (b - a) / 3600000;
}

/** DB stores billable travel time in minutes; linguist forms use hours. */
function travelHoursStrFromJobMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "";
  const h = minutes / 60;
  if (Number.isInteger(h)) return String(h);
  return String(Math.round(h * 100) / 100);
}

function formatTravelHoursDisplay(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return "—";
  const h = minutes / 60;
  return `${Math.round(h * 100) / 100} h`;
}

function SignatureField({
  label,
  value,
  onChange,
  resetKey,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  resetKey: number;
}) {
  const ref = useRef<SignatureCanvas | null>(null);

  useEffect(() => {
    const pad = ref.current;
    if (!pad) return;
    pad.clear();
    if (value.startsWith("data:image")) {
      void pad.fromDataURL(value);
    }
  }, [resetKey]);

  return (
    <div className={`${styles.label} ${styles.full}`}>
      <span>{label}</span>
      <div className={styles.sigWrap}>
        <SignatureCanvas
          ref={ref}
          canvasProps={{ className: styles.sigCanvas }}
          onEnd={() => {
            const pad = ref.current;
            if (!pad || pad.isEmpty()) {
              onChange("");
              return;
            }
            onChange(pad.toDataURL("image/png"));
          }}
        />
      </div>
      <button
        type="button"
        className={styles.sigClear}
        onClick={() => {
          ref.current?.clear();
          onChange("");
        }}
      >
        Clear signature
      </button>
    </div>
  );
}

function SignatureImage({ label, data }: { label: string; data: string | null }) {
  if (!data?.trim()) {
    return (
      <div className={styles.reportSigBlock}>
        <div className={styles.reportSigLabel}>{label}</div>
        <p className={styles.reportSigEmpty}>Not provided</p>
      </div>
    );
  }
  if (data.startsWith("data:image")) {
    return (
      <div className={styles.reportSigBlock}>
        <div className={styles.reportSigLabel}>{label}</div>
        <img className={styles.reportSigImg} src={data} alt="" />
      </div>
    );
  }
  return (
    <div className={styles.reportSigBlock}>
      <div className={styles.reportSigLabel}>{label}</div>
      <pre className={styles.reportSigText}>{data}</pre>
    </div>
  );
}

function StaffCompletionReport({ job, showPayForPrint }: { job: JobDetail; showPayForPrint: boolean }) {
  const isInterp = job.serviceCategory === "INTERPRETATION";

  return (
    <section className={`${styles.card} ${styles.completionReport}`} aria-label="Linguist completion submission">
      <div className={styles.reportLetterhead}>
        <div className={styles.reportLetterheadTop}>
          <img src="/iiw-logo.png" alt="" className={styles.reportLetterheadLogo} width={140} height={42} />
          <div className={styles.reportLetterheadBrand}>
            <span className={styles.reportLetterheadOrg}>International Institute of Wisconsin</span>
            <span className={styles.reportLetterheadDoc}>Linguist completion report</span>
          </div>
        </div>
        <div className={styles.reportLetterheadBar}>
          <span>
            Job <strong>{formatJobReference(job)}</strong>
          </span>
          <span className={styles.reportLetterheadPrinted}>Printed {new Date().toLocaleString()}</span>
        </div>
      </div>
      <div className={styles.reportHeader}>
        <h2 className={styles.h2}>Linguist completion</h2>
        <button type="button" className={`${styles.secondary} ${styles.screenOnly}`} onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <dl className={styles.reportDl}>
        <dt>Client name</dt>
        <dd>{job.client?.name ?? "—"}</dd>
        <dt>Consumer name</dt>
        <dd>{consumerDisplayName(job)}</dd>
        <dt>Requester name</dt>
        <dd>{job.requesterName ?? "—"}</dd>
        <dt>Address</dt>
        <dd>{jobAddressLine(job)}</dd>
        <dt>Linguist</dt>
        <dd>{job.interpreter?.name ?? "—"}</dd>
        <dt>Outcome</dt>
        <dd>
          {job.interpreterSessionOutcome === "LATE_CANCELLATION"
            ? "Late cancellation"
            : job.interpreterSessionOutcome === "COMPLETED_SESSION"
              ? "Completed session"
              : job.interpreterSessionOutcome ?? "—"}
        </dd>
        {isInterp ? (
          <>
            <dt>Session start (reported)</dt>
            <dd>{job.interpreterStartTime ? new Date(job.interpreterStartTime).toLocaleString() : "—"}</dd>
            <dt>Session end (reported)</dt>
            <dd>{job.interpreterEndTime ? new Date(job.interpreterEndTime).toLocaleString() : "—"}</dd>
            <dt>Outside county travel</dt>
            <dd>{job.interpreterTravelOutsideCounty === true ? "Yes" : "No"}</dd>
            <dt>Travel time (outside county)</dt>
            <dd>
              {job.interpreterTravelOutsideCounty === true && job.interpreterTravelTime != null
                ? formatTravelHoursDisplay(job.interpreterTravelTime)
                : "—"}
            </dd>
            <dt>Mileage (mi)</dt>
            <dd>{job.interpreterMileage != null ? String(job.interpreterMileage) : "—"}</dd>
            <dt>Staff name (facility)</dt>
            <dd>{job.staffName ?? "—"}</dd>
          </>
        ) : (
          <>
            <dt>Session start</dt>
            <dd>{job.interpreterStartTime ? new Date(job.interpreterStartTime).toLocaleString() : "—"}</dd>
            <dt>Session end</dt>
            <dd>{job.interpreterEndTime ? new Date(job.interpreterEndTime).toLocaleString() : "—"}</dd>
            <dt>Mileage (mi)</dt>
            <dd>{job.interpreterMileage != null ? String(job.interpreterMileage) : "—"}</dd>
            <dt>Travel time</dt>
            <dd>{formatTravelHoursDisplay(job.interpreterTravelTime)}</dd>
          </>
        )}
        <dt>Session notes</dt>
        <dd>{job.interpreterNotes ?? "—"}</dd>
        <dt>Completion notes</dt>
        <dd>{job.completionNotes ?? "—"}</dd>
        {job.completionDisputeNote?.trim() ? (
          <>
            <dt>Coordinator dispute feedback</dt>
            <dd>{job.completionDisputeNote}</dd>
          </>
        ) : null}
      </dl>

      {showPayForPrint ? (
        <div className={styles.payBreakdownPrintOnly} aria-hidden="true">
          <LinguistPayBreakdownBlock job={job} />
        </div>
      ) : null}

      <div className={styles.reportSigGrid}>
        {isInterp ? (
          <>
            <SignatureImage label="Staff signature" data={job.staffSignature} />
            <SignatureImage label="Interpreter signature" data={job.interpreterSignature} />
          </>
        ) : (
          <SignatureImage label="Interpreter attestation" data={job.interpreterSignature} />
        )}
      </div>
    </section>
  );
}

export function JobDetailPage() {
  const { id: paramId } = useParams();
  const id = Number(paramId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [staffFormKey, setStaffFormKey] = useState(0);

  const [staffPatch, setStaffPatch] = useState<Record<string, unknown>>({});
  const [sigResetKey, setSigResetKey] = useState(0);
  const [completionReviewBusy, setCompletionReviewBusy] = useState(false);
  const [completionDisputeDraft, setCompletionDisputeDraft] = useState("");
  const [interpPatch, setInterpPatch] = useState({
    interpreterNotes: "",
    interpreterSignature: "",
    completionNotes: "",
    interpreterStartTime: "",
    interpreterEndTime: "",
    interpreterMileage: "",
    interpreterTravelTime: "",
    sessionOutcome: "" as SessionOutcome,
    staffName: "",
    staffSignature: "",
    travelOutsideCounty: false,
  });

  async function load() {
    if (Number.isNaN(id)) return;
    setLoading(true);
    try {
      const { data } = await api.get<JobDetail>(`/api/jobs/${id}`);
      setJob(data);
      setStaffFormKey((k) => k + 1);
      setInterpPatch({
        interpreterNotes: data.interpreterNotes ?? "",
        interpreterSignature: data.interpreterSignature ?? "",
        completionNotes: data.completionNotes ?? "",
        interpreterStartTime: data.interpreterStartTime ? toLocalInput(data.interpreterStartTime) : "",
        interpreterEndTime: data.interpreterEndTime ? toLocalInput(data.interpreterEndTime) : "",
        interpreterMileage: data.interpreterMileage != null ? String(data.interpreterMileage) : "",
        interpreterTravelTime: travelHoursStrFromJobMinutes(data.interpreterTravelTime),
        sessionOutcome: (data.interpreterSessionOutcome as SessionOutcome) ?? ("" as SessionOutcome),
        staffName: data.staffName ?? "",
        staffSignature: data.staffSignature ?? "",
        travelOutsideCounty: data.interpreterTravelOutsideCounty === true,
      });
      setSigResetKey((k) => k + 1);
    } catch {
      setError("Could not load job.");
      setJob(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!paramId || Number.isNaN(id)) return;
    void load();
  }, [id, paramId]);

  useEffect(() => {
    if (job?.completionStatus === "PENDING_REVIEW") {
      setCompletionDisputeDraft("");
    }
  }, [job?.id, job?.completionStatus]);

  function staffSessionStartChange(v: string) {
    if (!job) return;
    setStaffPatch((s) => {
      const oldStart = (s.startTime as string | undefined) ?? toLocalInput(job.startTime);
      const currentEnd = (s.endTime as string | undefined) ?? toLocalInput(job.endTime);
      const nextEnd = pairEndAfterStartChange({
        newStartStr: v,
        previousStartStr: oldStart,
        currentEndStr: currentEnd,
        durationHours: 2,
      });
      if (nextEnd !== currentEnd) {
        return { ...s, startTime: v, endTime: nextEnd };
      }
      return { ...s, startTime: v };
    });
  }

  async function onStaffSubmit(e: FormEvent) {
    e.preventDefault();
    if (!job) return;
    const op = job.operationalStatus ?? "";
    const canStructural =
      op === "OPEN" || op === "ASSIGNED" || (!op && (job.status === "OPEN" || job.status === "ASSIGNED"));
    if (!canStructural) {
      setError("This assignment is read-only for coordinators in its current state.");
      return;
    }
    setError(null);
    try {
      const p = staffPatch;
      const startRaw = (p.startTime as string | undefined) ?? toLocalInput(job.startTime);
      const endRaw = (p.endTime as string | undefined) ?? toLocalInput(job.endTime);
      const dueRaw =
        (p.translationDueDate as string | undefined) ??
        (job.translationDueDate ? toLocalInput(job.translationDueDate) : "");

      const translationDueIso =
        typeof dueRaw === "string" && dueRaw.trim() !== "" ? new Date(dueRaw).toISOString() : null;

      const rushRaw = p.rushFee !== undefined ? p.rushFee : job.rushFee;
      const rushFeeOut =
        rushRaw === null || rushRaw === ""
          ? null
          : typeof rushRaw === "number"
            ? rushRaw
            : Number(rushRaw);

      const body: Record<string, unknown> = {
        status: (p.status as string | undefined) ?? job.status,
        language: (p.language as string | undefined) ?? job.language,
        startTime: new Date(startRaw).toISOString(),
        endTime: new Date(endRaw).toISOString(),
        rate: (p.rate as number | undefined) ?? job.rate,
        location: p.location !== undefined ? p.location : job.location,
        serviceCategory: (p.serviceCategory as string | undefined) ?? job.serviceCategory,
        serviceType: (p.serviceType as string | undefined) ?? job.serviceType,
        interpretationType: (p.interpretationType as string | undefined) ?? job.interpretationType,
        recipientName: (p.recipientName as string | undefined) ?? job.recipientName,
        requesterName: (p.requesterName as string | undefined) ?? job.requesterName,
        requesterEmail:
          p.requesterEmail !== undefined ? (p.requesterEmail as string) || null : job.requesterEmail ?? null,
        targetLanguage: (p.targetLanguage as string | undefined) ?? job.targetLanguage,
        translationDueDate: translationDueIso,
        translationClientName: (p.translationClientName as string | undefined) ?? job.translationClientName,
        rushFee: rushFeeOut === null || Number.isNaN(rushFeeOut as number) ? null : rushFeeOut,
        notes: (p.notes as string | undefined) ?? job.notes,
      };

      await api.patch(`/api/jobs/${id}`, body);
      await load();
      setStaffPatch({});
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        const msg = err.response?.data && typeof err.response.data === "object" && err.response.data !== null && "error" in err.response.data
          ? String((err.response.data as { error: unknown }).error)
          : "Update not allowed for this assignment.";
        setError(msg);
      } else {
        setError("Update failed.");
      }
    }
  }

  async function markJobPaid() {
    if (!job) return;
    setError(null);
    try {
      await api.patch(`/api/jobs/${id}`, { status: "PAID" });
      await load();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        const msg =
          err.response?.data &&
          typeof err.response.data === "object" &&
          err.response.data !== null &&
          "error" in err.response.data
            ? String((err.response.data as { error: unknown }).error)
            : "Could not mark paid.";
        setError(msg);
      } else {
        setError("Could not mark paid.");
      }
    }
  }

  async function submitCompletion(e: FormEvent | null, markCompleted: boolean) {
    e?.preventDefault();
    if (!job) return;
    setError(null);

    const isTransJob = job.serviceCategory === "TRANSLATION";

    if (markCompleted && !isTransJob) {
      if (!interpPatch.sessionOutcome) {
        setError("Select whether the session was completed or a late cancellation.");
        return;
      }
      if (!interpPatch.staffName.trim()) {
        setError("Staff name is required.");
        return;
      }
      if (!interpPatch.staffSignature.trim()) {
        setError("Staff signature is required.");
        return;
      }
      if (!interpPatch.interpreterSignature.trim()) {
        setError("Interpreter signature is required.");
        return;
      }
      if (interpPatch.sessionOutcome === "COMPLETED_SESSION") {
        const h = sessionHoursFromLocal(interpPatch.interpreterStartTime, interpPatch.interpreterEndTime);
        if (h == null) {
          setError("Enter valid session start and end times.");
          return;
        }
        if (h < 2) {
          setError("Completed sessions must be at least 2 hours.");
          return;
        }
      }
    }

    const rawTravel = interpPatch.interpreterTravelTime.trim();
    const travelHoursParsed = rawTravel === "" ? null : Number(rawTravel);
    if (rawTravel !== "") {
      if (travelHoursParsed === null || !Number.isFinite(travelHoursParsed) || travelHoursParsed < 0) {
        setError("Enter a valid number for travel time (hours).");
        return;
      }
      const travelMinsRounded = Math.round(travelHoursParsed * 60);
      if (travelMinsRounded > 0 && travelMinsRounded < 60) {
        setError("Travel time must be at least 1 hour.");
        return;
      }
    }

    const travelMinsComputed =
      rawTravel === "" || travelHoursParsed == null || !Number.isFinite(travelHoursParsed)
        ? null
        : Math.round(travelHoursParsed * 60);

    let travelMinutesOut: number | null = null;
    if (isTransJob) {
      travelMinutesOut = travelMinsComputed != null && travelMinsComputed > 0 ? travelMinsComputed : null;
    } else if (interpPatch.travelOutsideCounty) {
      travelMinutesOut = travelMinsComputed != null && travelMinsComputed > 0 ? travelMinsComputed : null;
    } else {
      travelMinutesOut = null;
    }

    try {
      const body: Record<string, unknown> = {
        interpreterNotes: interpPatch.interpreterNotes || null,
        completionNotes: interpPatch.completionNotes || null,
        markCompleted,
      };

      if (isTransJob) {
        body.interpreterSignature = interpPatch.interpreterSignature || null;
        body.interpreterStartTime = interpPatch.interpreterStartTime
          ? new Date(interpPatch.interpreterStartTime).toISOString()
          : null;
        body.interpreterEndTime = interpPatch.interpreterEndTime
          ? new Date(interpPatch.interpreterEndTime).toISOString()
          : null;
        body.interpreterMileage = interpPatch.interpreterMileage ? Number(interpPatch.interpreterMileage) : null;
        body.interpreterTravelTime = travelMinutesOut;
        if (markCompleted) {
          body.completionStatus = "PENDING_REVIEW";
        }
      } else {
        body.interpreterSignature = interpPatch.interpreterSignature || null;
        body.staffName = interpPatch.staffName.trim() || null;
        body.staffSignature = interpPatch.staffSignature || null;
        body.travelOutsideCounty = interpPatch.travelOutsideCounty;
        body.interpreterStartTime = interpPatch.interpreterStartTime
          ? new Date(interpPatch.interpreterStartTime).toISOString()
          : null;
        body.interpreterEndTime = interpPatch.interpreterEndTime
          ? new Date(interpPatch.interpreterEndTime).toISOString()
          : null;
        body.interpreterMileage = interpPatch.interpreterMileage ? Number(interpPatch.interpreterMileage) : null;
        body.interpreterTravelTime = travelMinutesOut;
        if (interpPatch.sessionOutcome) {
          body.sessionOutcome = interpPatch.sessionOutcome;
        }
        if (markCompleted) {
          body.completionStatus = "PENDING_REVIEW";
        }
      }

      await api.post(`/api/jobs/${id}/complete`, body);
      await load();
    } catch (err) {
      if (
        isAxiosError(err) &&
        err.response?.data &&
        typeof err.response.data === "object" &&
        err.response.data !== null &&
        "error" in err.response.data
      ) {
        setError(String((err.response.data as { error: unknown }).error));
      } else {
        setError("Could not save completion.");
      }
    }
  }

  async function applyCompletionReview(next: "APPROVED" | "DISPUTED") {
    if (!job) return;
    setCompletionReviewBusy(true);
    setError(null);
    try {
      const body =
        next === "DISPUTED"
          ? {
              completionStatus: next,
              completionDisputeNote: completionDisputeDraft.trim() || null,
            }
          : { completionStatus: next };
      await api.patch(`/api/jobs/${id}`, body);
      await load();
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        const msg =
          err.response?.data &&
          typeof err.response.data === "object" &&
          err.response.data !== null &&
          "error" in err.response.data
            ? String((err.response.data as { error: unknown }).error)
            : "Could not update completion review.";
        setError(msg);
      } else {
        setError("Could not update completion review.");
      }
    } finally {
      setCompletionReviewBusy(false);
    }
  }

  if (!paramId || Number.isNaN(id)) {
    return <Navigate to="/assignments" replace />;
  }

  if (loading || !job) {
    if (error && !loading) {
      return (
        <div className={styles.page}>
          <p className={styles.error}>{error}</p>
          <Link className={styles.back} to="/assignments">
            Back to assignments
          </Link>
        </div>
      );
    }
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  const mine = user?.role === "INTERPRETER" && job.interpreterId === user.id;
  const isInterp = job.serviceCategory === "INTERPRETATION";
  const isTrans = job.serviceCategory === "TRANSLATION";
  const op = job.operationalStatus ?? "";
  const canStaffEditCoordinatorForm =
    isStaff &&
    (op === "OPEN" || op === "ASSIGNED" || (!op && (job.status === "OPEN" || job.status === "ASSIGNED")));
  const staffSeesSubmissionReport =
    isStaff &&
    (job.completionStatus !== "NONE" ||
      !!job.interpreterSignature?.trim() ||
      !!job.staffSignature?.trim() ||
      !!job.interpreterStartTime ||
      !!job.interpreterEndTime ||
      (job.interpreterMileage != null && job.interpreterMileage > 0) ||
      (job.interpreterTravelTime != null && job.interpreterTravelTime > 0));
  /** Staff "Coordinator update" form: which fields to show follows the category control (including mid-edit switches). */
  const coordinatorCategory =
    typeof staffPatch.serviceCategory === "string" ? staffPatch.serviceCategory : job.serviceCategory;
  const coordIsInterp = coordinatorCategory === "INTERPRETATION";
  const coordIsTrans = coordinatorCategory === "TRANSLATION";
  const interpSessionHours =
    mine && isInterp
      ? sessionHoursFromLocal(interpPatch.interpreterStartTime, interpPatch.interpreterEndTime)
      : null;

  function printIiwJobForm() {
    document.body.classList.add("iiw-print-job-record");
    const onAfter = () => {
      document.body.classList.remove("iiw-print-job-record");
      window.removeEventListener("afterprint", onAfter);
    };
    window.addEventListener("afterprint", onAfter);
    window.print();
  }

  return (
    <div className={styles.page}>
      <header className={`${styles.header} ${styles.screenOnly}`}>
        <div>
          <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
            ← Back
          </button>
          <h1 className={styles.title}>Job {formatJobReference(job)}</h1>
          <p className={styles.meta}>
            {isInterp ? "Interpretation" : isTrans ? "Translation" : job.serviceCategory} · {job.language}
            {job.targetLanguage ? ` → ${job.targetLanguage}` : ""} · <span className={styles.status}>{job.status}</span>
          </p>
        </div>
      </header>

      <div className={`${styles.screenOnly} ${styles.stepperWrap}`}>
        <JobStatusStepper job={job} />
      </div>

      {error ? (
        <p className={`${styles.banner} ${styles.screenOnly}`} role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      {!(isStaff && canStaffEditCoordinatorForm) ? (
        <JobReadonlyDetailsCard
          job={job}
          isStaff={isStaff}
          mine={mine}
          onPrintIiw={printIiwJobForm}
          showLinguistPay={isStaff && staffSeesSubmissionReport}
        />
      ) : null}

      <div className={`job-print-root ${styles.jobPrintRoot}`} aria-hidden="true">
        <div className="job-form-root bg-white font-sans text-slate-900 print:p-4">
          <JobFormPrintStyleTag />
          <div className="mx-auto max-w-3xl p-8 print:p-4">
            <JobTailwindFormSheet job={job} viewerIsStaff={isStaff} mine={mine} />
          </div>
        </div>
      </div>

      {staffSeesSubmissionReport ? <StaffCompletionReport job={job} showPayForPrint={isStaff} /> : null}

      {isStaff && canStaffEditCoordinatorForm ? (
        <form
          key={`staff-${staffFormKey}`}
          className={`${styles.screenOnly} ${styles.card}`}
          onSubmit={onStaffSubmit}
        >
          <h2 className={styles.h2}>Coordinator update</h2>

          <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}>Status &amp; category</h3>
            <div className={styles.grid}>
              <label className={styles.label}>
                Status
                <select
                  className={styles.input}
                  defaultValue={job.status}
                  onChange={(ev) => setStaffPatch((s) => ({ ...s, status: ev.target.value }))}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="PAID">PAID</option>
                </select>
              </label>
              <label className={styles.label}>
                Service category
                <select
                  className={styles.input}
                  defaultValue={job.serviceCategory}
                  onChange={(ev) => setStaffPatch((s) => ({ ...s, serviceCategory: ev.target.value }))}
                >
                  <option value="INTERPRETATION">Interpretation</option>
                  <option value="TRANSLATION">Translation</option>
                </select>
              </label>
            </div>
          </div>

          {coordIsInterp ? (
            <div className={styles.formSection}>
              <h3 className={styles.formSectionTitle}>Interpretation</h3>
              <div className={styles.grid}>
                <label className={styles.label}>
                  Language
                  <input
                    className={styles.input}
                    defaultValue={job.language}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, language: ev.target.value }))}
                  />
                </label>
                <label className={styles.label}>
                  Modality
                  <select
                    className={styles.input}
                    defaultValue={job.serviceType}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, serviceType: ev.target.value }))}
                  >
                    <option value="IN_PERSON">In person</option>
                    <option value="VIRTUAL">Virtual</option>
                    <option value="PHONE">Phone</option>
                  </select>
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Interpretation domain
                  <select
                    className={styles.input}
                    defaultValue={job.interpretationType ?? "OTHER"}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, interpretationType: ev.target.value || null }))}
                  >
                    <option value="IMMIGRATION">Immigration</option>
                    <option value="MEDICAL">Medical</option>
                    <option value="SOCIAL_SERVICES">Social services</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className={styles.label}>
                  Session start
                  <LocalDateTimePicker
                    className={styles.input}
                    value={(staffPatch.startTime as string | undefined) ?? toLocalInput(job.startTime)}
                    onChange={staffSessionStartChange}
                  />
                </label>
                <label className={styles.label}>
                  Session end
                  <LocalDateTimePicker
                    className={styles.input}
                    value={(staffPatch.endTime as string | undefined) ?? toLocalInput(job.endTime)}
                    onChange={(v) => setStaffPatch((s) => ({ ...s, endTime: v }))}
                  />
                </label>
                <label className={styles.label}>
                  Rate ($ / hour)
                  <input
                    className={styles.input}
                    type="number"
                    step="0.01"
                    defaultValue={job.rate}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, rate: Number(ev.target.value) }))}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Location
                  <input
                    className={styles.input}
                    defaultValue={job.location ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, location: ev.target.value || null }))}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Consumer / recipient name
                  <input
                    className={styles.input}
                    defaultValue={job.recipientName ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, recipientName: ev.target.value || null }))}
                  />
                </label>
                <label className={styles.label}>
                  Requester name
                  <input
                    className={styles.input}
                    defaultValue={job.requesterName ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, requesterName: ev.target.value || null }))}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Requester email
                  <input
                    className={styles.input}
                    type="email"
                    defaultValue={job.requesterEmail ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, requesterEmail: ev.target.value || null }))}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {coordIsTrans ? (
            <div className={styles.formSection}>
              <h3 className={styles.formSectionTitle}>Translation</h3>
              <div className={styles.grid}>
                <label className={styles.label}>
                  Original language
                  <input
                    className={styles.input}
                    defaultValue={job.language}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, language: ev.target.value }))}
                  />
                </label>
                <label className={styles.label}>
                  Target language
                  <input
                    className={styles.input}
                    defaultValue={job.targetLanguage ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, targetLanguage: ev.target.value || null }))}
                  />
                </label>
                <label className={styles.label}>
                  Translation due (local)
                  <LocalDateTimePicker
                    className={styles.input}
                    value={
                      staffPatch.translationDueDate !== undefined
                        ? staffPatch.translationDueDate === null
                          ? ""
                          : String(staffPatch.translationDueDate)
                        : job.translationDueDate
                          ? toLocalInput(job.translationDueDate)
                          : ""
                    }
                    onChange={(v) => setStaffPatch((s) => ({ ...s, translationDueDate: v.trim() === "" ? null : v }))}
                  />
                </label>
                <label className={styles.label}>
                  Flat rate ($)
                  <input
                    className={styles.input}
                    type="number"
                    step="0.01"
                    defaultValue={job.rate}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, rate: Number(ev.target.value) }))}
                  />
                </label>
                <label className={styles.label}>
                  Rush fee ($)
                  <input
                    className={styles.input}
                    type="number"
                    step="0.01"
                    defaultValue={job.rushFee != null ? String(job.rushFee) : ""}
                    onChange={(ev) =>
                      setStaffPatch((s) => ({
                        ...s,
                        rushFee: ev.target.value === "" ? null : Number(ev.target.value),
                      }))
                    }
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Translation client name
                  <input
                    className={styles.input}
                    defaultValue={job.translationClientName ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, translationClientName: ev.target.value || null }))}
                  />
                </label>
                <label className={styles.label}>
                  Requester name (optional)
                  <input
                    className={styles.input}
                    defaultValue={job.requesterName ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, requesterName: ev.target.value || null }))}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Requester email (optional)
                  <input
                    className={styles.input}
                    type="email"
                    defaultValue={job.requesterEmail ?? ""}
                    onChange={(ev) => setStaffPatch((s) => ({ ...s, requesterEmail: ev.target.value || null }))}
                  />
                </label>
                <label className={styles.label}>
                  Session window (start)
                  <LocalDateTimePicker
                    className={styles.input}
                    value={(staffPatch.startTime as string | undefined) ?? toLocalInput(job.startTime)}
                    onChange={staffSessionStartChange}
                  />
                </label>
                <label className={styles.label}>
                  Session window (end)
                  <LocalDateTimePicker
                    className={styles.input}
                    value={(staffPatch.endTime as string | undefined) ?? toLocalInput(job.endTime)}
                    onChange={(v) => setStaffPatch((s) => ({ ...s, endTime: v }))}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}>Notes</h3>
            <label className={`${styles.label} ${styles.full}`}>
              Internal notes
              <textarea
                className={styles.textarea}
                defaultValue={job.notes ?? ""}
                onChange={(ev) => setStaffPatch((s) => ({ ...s, notes: ev.target.value || null }))}
                rows={3}
              />
            </label>
          </div>

          <div className={styles.stickyFormActions}>
            <div className={styles.actions}>
              <Link
                to={`/jobs/${id}/form`}
                className={styles.secondary}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open worksheet
              </Link>
              <button type="button" className={styles.secondary} onClick={() => printIiwJobForm()}>
                Print IIW job form
              </button>
              <button className={styles.primary} type="submit">
                Save changes
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {isStaff && job.completionStatus === "PENDING_REVIEW" ? (
        <section className={`${styles.card} ${styles.screenOnly}`}>
          <h2 className={styles.h2}>
            Completion review — {isInterp ? "Interpretation" : isTrans ? "Translation" : "Assignment"}
          </h2>
          <p className={styles.help}>
            {isTrans
              ? "The linguist marked this translation complete and it is awaiting your approval. Approve it, or dispute it so they can correct the submission and send it again."
              : "The interpreter submitted session completion paperwork. Approve it, or dispute it so they can correct the submission and send it again."}
          </p>
          <label className={`${styles.label} ${styles.full}`}>
            <span>Note for linguist (optional)</span>
            <textarea
              className={styles.textarea}
              value={completionDisputeDraft}
              onChange={(ev) => setCompletionDisputeDraft(ev.target.value)}
              rows={3}
              placeholder="If you dispute, explain what needs to change — they will see this on the assignment."
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={completionReviewBusy}
              onClick={() => void applyCompletionReview("APPROVED")}
            >
              Approve completion
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={completionReviewBusy}
              onClick={() => void applyCompletionReview("DISPUTED")}
            >
              Dispute submission
            </button>
          </div>
        </section>
      ) : null}

      {isStaff &&
      job.completionStatus === "APPROVED" &&
      job.status !== "PAID" &&
      (job.billingStatus == null || job.billingStatus !== "PAID") ? (
        <section className={`${styles.card} ${styles.screenOnly}`}>
          <h2 className={styles.h2}>Mark paid</h2>
          <p className={styles.help}>When billing is reconciled, record that this assignment has been paid.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => void markJobPaid()}>
              Mark job paid
            </button>
          </div>
        </section>
      ) : null}

      {mine && (job.completionStatus === "PENDING_REVIEW" || job.completionStatus === "APPROVED") ? (
        <section className={styles.card}>
          <h2 className={styles.h2}>Completion</h2>
          <p className={styles.help}>
            {job.completionStatus === "PENDING_REVIEW"
              ? "Your completion was submitted and is awaiting coordinator review. You cannot submit again unless they dispute it."
              : "Your completion was approved by the coordinator."}
          </p>
        </section>
      ) : mine ? (
        <form
          className={styles.card}
          onSubmit={(e) => {
            void submitCompletion(e, true);
          }}
        >
          <h2 className={styles.h2}>Completion & session notes</h2>
          {job.completionStatus === "DISPUTED" ? (
            <div className={styles.help}>
              <p>
                <strong>Note:</strong> The coordinator disputed your submission. Update the fields below and submit again for
                review.
              </p>
              {job.completionDisputeNote?.trim() ? (
                <div className={styles.disputeFeedback}>
                  <strong>Coordinator feedback</strong>
                  <p className={styles.disputeFeedbackBody}>{job.completionDisputeNote}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {isTrans ? (
            <>
              <div className={styles.grid}>
                <label className={styles.label}>
                  Session start
                  <LocalDateTimePicker
                    className={styles.input}
                    value={interpPatch.interpreterStartTime}
                    onChange={(v) => setInterpPatch((s) => ({ ...s, interpreterStartTime: v }))}
                  />
                </label>
                <label className={styles.label}>
                  Session end
                  <LocalDateTimePicker
                    className={styles.input}
                    value={interpPatch.interpreterEndTime}
                    onChange={(v) => setInterpPatch((s) => ({ ...s, interpreterEndTime: v }))}
                  />
                </label>
                <label className={styles.label}>
                  Mileage (mi)
                  <input
                    className={styles.input}
                    type="number"
                    value={interpPatch.interpreterMileage}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, interpreterMileage: ev.target.value }))}
                  />
                </label>
                <label className={styles.label}>
                  Travel time (hours)
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    step={0.25}
                    placeholder="e.g. 1.5"
                    value={interpPatch.interpreterTravelTime}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, interpreterTravelTime: ev.target.value }))}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Session notes
                  <textarea
                    className={styles.textarea}
                    value={interpPatch.interpreterNotes}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, interpreterNotes: ev.target.value }))}
                    rows={3}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Completion notes (for coordinator)
                  <textarea
                    className={styles.textarea}
                    value={interpPatch.completionNotes}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, completionNotes: ev.target.value }))}
                    rows={2}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Signature / attestation
                  <input
                    className={styles.input}
                    value={interpPatch.interpreterSignature}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, interpreterSignature: ev.target.value }))}
                  />
                </label>
              </div>
              <div className={styles.stickyFormActions}>
                <div className={styles.actions}>
                  <button className={styles.secondary} type="button" onClick={() => void submitCompletion(null, false)}>
                    Save progress
                  </button>
                  <button className={styles.primary} type="submit">
                    Submit completion
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className={styles.help}>
                {user?.residentialCounty ? (
                  <>
                    Your residential county on file: <strong>{user.residentialCounty}</strong>. Travel time is only used
                    when you check that you traveled outside that county. Enter time in <strong>hours</strong> (minimum{" "}
                    <strong>1 hour</strong> when billing travel).
                  </>
                ) : (
                  "Ask your coordinator to record your residential county on your profile so travel-time rules apply."
                )}
              </p>

              <fieldset className={styles.outcomeFieldset}>
                <legend className={styles.legend}>Outcome</legend>
                <label className={styles.radioRow}>
                  <input
                    type="radio"
                    name="sessionOutcome"
                    checked={interpPatch.sessionOutcome === "COMPLETED_SESSION"}
                    onChange={() => setInterpPatch((s) => ({ ...s, sessionOutcome: "COMPLETED_SESSION" }))}
                  />
                  Completed session
                </label>
                <label className={styles.radioRow}>
                  <input
                    type="radio"
                    name="sessionOutcome"
                    checked={interpPatch.sessionOutcome === "LATE_CANCELLATION"}
                    onChange={() => setInterpPatch((s) => ({ ...s, sessionOutcome: "LATE_CANCELLATION" }))}
                  />
                  Late cancellation
                </label>
              </fieldset>

              <div className={styles.grid}>
                <label className={styles.label}>
                  Session start
                  <LocalDateTimePicker
                    className={styles.input}
                    value={interpPatch.interpreterStartTime}
                    onChange={(v) => setInterpPatch((s) => ({ ...s, interpreterStartTime: v }))}
                  />
                </label>
                <label className={styles.label}>
                  Session end
                  <LocalDateTimePicker
                    className={styles.input}
                    value={interpPatch.interpreterEndTime}
                    onChange={(v) => setInterpPatch((s) => ({ ...s, interpreterEndTime: v }))}
                  />
                </label>
                <div className={`${styles.label} ${styles.full}`}>
                  <span>Total hours</span>
                  <p className={styles.totalHours}>
                    {interpSessionHours != null ? `${interpSessionHours.toFixed(2)} h` : "—"}
                    {interpPatch.sessionOutcome === "COMPLETED_SESSION" ? (
                      <span className={styles.subtle}> (minimum 2 hours to submit as completed)</span>
                    ) : null}
                  </p>
                </div>
                <label className={styles.label}>
                  Mileage (mi)
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    step="0.1"
                    value={interpPatch.interpreterMileage}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, interpreterMileage: ev.target.value }))}
                  />
                </label>

                <label className={`${styles.check} ${styles.full}`}>
                  <input
                    type="checkbox"
                    checked={interpPatch.travelOutsideCounty}
                    onChange={(ev) =>
                      setInterpPatch((s) => ({
                        ...s,
                        travelOutsideCounty: ev.target.checked,
                        interpreterTravelTime: ev.target.checked ? (s.interpreterTravelTime.trim() || "1") : "",
                      }))
                    }
                  />
                  I traveled outside my residential county (travel time may apply)
                </label>

                {interpPatch.travelOutsideCounty ? (
                  <label className={styles.label}>
                    Travel time (hours)
                    <input
                      className={styles.input}
                      type="number"
                      min={1}
                      step={0.25}
                      placeholder="Minimum 1"
                      value={interpPatch.interpreterTravelTime}
                      onChange={(ev) => setInterpPatch((s) => ({ ...s, interpreterTravelTime: ev.target.value }))}
                    />
                  </label>
                ) : null}

                <label className={`${styles.label} ${styles.full}`}>
                  Staff name (at facility)
                  <input
                    className={styles.input}
                    value={interpPatch.staffName}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, staffName: ev.target.value }))}
                  />
                </label>

                <SignatureField
                  label="Staff signature"
                  value={interpPatch.staffSignature}
                  onChange={(v) => setInterpPatch((s) => ({ ...s, staffSignature: v }))}
                  resetKey={sigResetKey}
                />
                <SignatureField
                  label="Interpreter signature"
                  value={interpPatch.interpreterSignature}
                  onChange={(v) => setInterpPatch((s) => ({ ...s, interpreterSignature: v }))}
                  resetKey={sigResetKey}
                />

                <label className={`${styles.label} ${styles.full}`}>
                  Session notes
                  <textarea
                    className={styles.textarea}
                    value={interpPatch.interpreterNotes}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, interpreterNotes: ev.target.value }))}
                    rows={3}
                  />
                </label>
                <label className={`${styles.label} ${styles.full}`}>
                  Completion notes (for coordinator)
                  <textarea
                    className={styles.textarea}
                    value={interpPatch.completionNotes}
                    onChange={(ev) => setInterpPatch((s) => ({ ...s, completionNotes: ev.target.value }))}
                    rows={2}
                  />
                </label>
              </div>

              <div className={styles.stickyFormActions}>
                <div className={styles.actions}>
                  <button className={styles.secondary} type="button" onClick={() => void submitCompletion(null, false)}>
                    Save progress
                  </button>
                  <button className={styles.primary} type="submit">
                    Submit completion
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      ) : null}
    </div>
  );
}
