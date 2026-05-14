import type { ReactNode } from "react";
import {
  BuildingOffice2Icon,
  ClockIcon,
  DocumentTextIcon,
  MapIcon,
  PaperClipIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { formatJobReference } from "@interpret-hub/shared";
import { resolveUploadUrl } from "@/utils/resolve-upload-url";

/** Job fields needed for the IIW worksheet (API job detail satisfies this). */
export type JobFormPrintJob = {
  id: number;
  jobCode: string | null;
  status: string;
  language: string;
  targetLanguage: string | null;
  serviceType: string;
  serviceCategory: string;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string | null;
  translationDueDate: string | null;
  translationClientName: string | null;
  recipientName: string | null;
  requesterName: string | null;
  requesterEmail?: string | null;
  staffName: string | null;
  interpretationType: string | null;
  rate: number;
  rushFee: number | null;
  completionStatus: string;
  attachmentUrl: string | null;
  interpreterId: number | null;
  interpreterStartTime: string | null;
  interpreterEndTime: string | null;
  interpreterMileage: number | null;
  interpreterTravelTime: number | null;
  interpreterNotes: string | null;
  interpreterSessionOutcome: string | null;
  interpreterTravelOutsideCounty: boolean | null;
  interpreterSignature: string | null;
  staffSignature: string | null;
  client: { id: number; name: string } | null;
  interpreter: { id: number; name: string; email: string } | null;
};

export type JobTailwindFormSheetProps = {
  job: JobFormPrintJob;
  /** When true, show coordinator-only rows (e.g. rate, completion review). */
  viewerIsStaff?: boolean;
  /** Interpreter viewing their own assignment — hides some staff billing on the sheet. */
  mine?: boolean;
};

export function JobFormPrintStyleTag() {
  return (
    <style>{`
      @media print {
        @page { margin: 0.75in; size: letter; }
        .job-form-no-print { display: none !important; }
        .job-form-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  );
}

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

function fullDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function travelHrsDisplay(minutes: number | null | undefined) {
  if (minutes == null || minutes <= 0) return "_______ hrs";
  const h = minutes / 60;
  return `${Math.round(h * 100) / 100} hrs`;
}

function modalityLabel(code: string): string {
  switch (code) {
    case "IN_PERSON":
      return "IN_PERSON";
    case "VIRTUAL":
      return "VIRTUAL";
    case "PHONE":
      return "PHONE";
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

function sessionOutcomeLabel(code: string | null | undefined) {
  if (code === "LATE_CANCELLATION") return "Late cancellation";
  if (code === "COMPLETED_SESSION") return "Completed session";
  return code?.trim() ? code : "—";
}

const labelClass =
  "mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5";
const valueClass = "text-sm font-medium text-slate-900";

function Field({ label, value, children }: { label: string; value?: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      {children ?? <p className={valueClass}>{value}</p>}
    </div>
  );
}

function SignatureBlock({ data }: { data: string | null | undefined }) {
  const s = data?.trim();
  if (!s) return null;
  if (s.startsWith("data:image")) {
    return (
      <img
        src={s}
        alt=""
        className="max-h-12 max-w-full object-contain object-left-bottom [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:max-h-[3rem]"
      />
    );
  }
  return <p className="pt-2 text-sm italic text-slate-700">{s}</p>;
}

function sectionTitle(icon: ReactNode, text: string) {
  return (
    <p className={`${labelClass} mb-3`}>
      <span className="text-iiw-600">{icon}</span>
      {text}
    </p>
  );
}

export function JobTailwindFormSheet({ job, viewerIsStaff = false, mine = false }: JobTailwindFormSheetProps) {
  const isInterp = job.serviceCategory === "INTERPRETATION";
  const isTrans = job.serviceCategory === "TRANSLATION";
  const refText = formatJobReference(job);
  const staff = job.staffName?.trim();
  const showInterpBilling = viewerIsStaff && !mine && isInterp;
  const showTransCompletion = viewerIsStaff && isTrans;
  const attachmentHref = job.attachmentUrl ? resolveUploadUrl(job.attachmentUrl) : undefined;

  return (
    <div
      className="overflow-hidden rounded-sm border-2 border-slate-900 shadow-sm print:shadow-none"
      data-job-tailwind-form
    >
      <header className="flex flex-wrap items-center justify-between gap-4 bg-iiw-600 px-6 py-4 text-white print:border-b print:border-white/20">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1 ring-2 ring-white/40">
            <img src="/iiw-logo.png" alt="IIW Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-bold leading-tight text-lg">
              <BuildingOffice2Icon className="h-6 w-6 shrink-0 text-iiw-100" aria-hidden />
              <span className="truncate">International Institute of Wisconsin</span>
            </p>
            <p className="mt-0.5 text-sm text-iiw-100">Interpretation Services</p>
            <p className="mt-0.5 text-xs leading-snug text-iiw-200">
              1110 N Dr. Martin Luther King Jr. Suite 420, Milwaukee, Wisconsin 53203
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="flex items-center justify-end gap-1.5 text-xs font-medium uppercase tracking-wider text-iiw-100">
            <DocumentTextIcon className="h-4 w-4" aria-hidden />
            Service Record
          </p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums">{refText}</p>
        </div>
      </header>

      <div className="space-y-5 p-6">
        {isInterp ? (
          <>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <Field label="Service Date" value={fmtDate(job.startTime)} />
              <Field label="Service Type" value={modalityLabel(job.serviceType)} />
              <Field label="Language" value={job.language} />
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
              <Field label="Interpretation domain" value={domainLabel(job.interpretationType)} />
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
              <Field label="Client / Organization" value={job.client?.name ?? "—"} />
              <Field label="Location" value={job.location?.trim() ? job.location : "—"} />
              <Field label="Interpreter" value={job.interpreter?.name ?? "—"} />
              <Field label="Status" value={job.status} />
              {staff ? <Field label="Staff name (facility)" value={staff} /> : null}
            </div>

            {showInterpBilling ? (
              <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
                <Field label="Rate (billing)" value={`$${job.rate.toFixed(2)}`} />
                <Field label="Completion review" value={completionStatusLabel(job.completionStatus)} />
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
              <Field
                label="Requester email"
                value={job.requesterEmail?.trim() ? job.requesterEmail : "—"}
              />
            </div>
          </>
        ) : null}

        {isTrans ? (
          <>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <Field label="Service category" value="TRANSLATION" />
              <Field label="Original language" value={job.language} />
              <Field label="Target language" value={job.targetLanguage ?? "—"} />
            </div>
            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
              <Field label="Client / Organization" value={job.client?.name ?? "—"} />
              <Field label="Client name (matter)" value={job.translationClientName ?? "—"} />
              <Field label="Due date" value={job.translationDueDate ? fmtDate(job.translationDueDate) : "—"} />
              <Field label="Interpreter" value={job.interpreter?.name ?? "—"} />
              <Field label="Status" value={job.status} />
            </div>
            {showTransCompletion ? (
              <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
                <Field label="Completion review" value={completionStatusLabel(job.completionStatus)} />
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 text-sm sm:grid-cols-2">
              <Field label="Requester name" value={job.requesterName?.trim() ? job.requesterName : "—"} />
              <Field label="Requester email" value={job.requesterEmail?.trim() ? job.requesterEmail : "—"} />
            </div>
          </>
        ) : null}

        <div className="border-t border-slate-200 pt-4">
          {sectionTitle(<ClockIcon className="h-4 w-4" aria-hidden />, "Service Times")}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Scheduled start", val: fullDateTime(job.startTime) },
              { label: "Scheduled end", val: fullDateTime(job.endTime) },
              { label: "Actual start", val: fullDateTime(job.interpreterStartTime) },
              { label: "Actual end", val: fullDateTime(job.interpreterEndTime) },
            ].map(({ label, val }) => (
              <div
                key={label}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 ring-1 ring-inset ring-slate-100/80"
              >
                <p className="mb-1 text-xs text-slate-500">{label}</p>
                <p className="text-xs font-medium leading-snug text-slate-900 sm:text-sm">{val}</p>
              </div>
            ))}
          </div>
        </div>

        {isInterp ? (
          <div className="border-t border-slate-200 pt-4">
            {sectionTitle(<UserCircleIcon className="h-4 w-4" aria-hidden />, "Session details")}
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <Field label="Consumer (receiving service)" value={job.recipientName ?? "—"} />
              <Field label="Requester name" value={job.requesterName ?? "—"} />
              <Field label="Session outcome" value={sessionOutcomeLabel(job.interpreterSessionOutcome)} />
              <Field
                label="Outside-county travel"
                value={
                  job.interpreterTravelOutsideCounty === true
                    ? "Yes"
                    : job.interpreterTravelOutsideCounty === false
                      ? "No"
                      : "—"
                }
              />
            </div>
          </div>
        ) : null}

        {isTrans ? (
          <div className="border-t border-slate-200 pt-4">
            {sectionTitle(<DocumentTextIcon className="h-4 w-4" aria-hidden />, "Billing (translation)")}
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <Field label="Flat rate" value={`$${job.rate.toFixed(2)}`} />
              <Field
                label="Rush fee"
                value={job.rushFee != null && job.rushFee > 0 ? `$${job.rushFee.toFixed(2)}` : "—"}
              />
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-200 pt-4">
          {sectionTitle(<MapIcon className="h-4 w-4" aria-hidden />, "Travel & Expenses")}
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-slate-500">Miles traveled</p>
              <p className="font-medium text-slate-900">
                {job.interpreterMileage != null && Number.isFinite(job.interpreterMileage)
                  ? `${job.interpreterMileage} mi`
                  : "_______ mi"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-500">Travel time</p>
              <p className="font-medium text-slate-900">{travelHrsDisplay(job.interpreterTravelTime)}</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 text-sm">
          <p className={labelClass}>Notes</p>
          <p className={`${valueClass} whitespace-pre-wrap break-words`}>{job.notes?.trim() ? job.notes : "—"}</p>
        </div>

        {job.interpreterNotes?.trim() ? (
          <div className="border-t border-slate-200 pt-4 text-sm">
            <p className={labelClass}>Interpreter notes</p>
            <p className={`${valueClass} whitespace-pre-wrap break-words`}>{job.interpreterNotes}</p>
          </div>
        ) : null}

        {job.attachmentUrl && attachmentHref ? (
          <div className="border-t border-slate-200 pt-4 text-sm">
            {sectionTitle(<PaperClipIcon className="h-4 w-4" aria-hidden />, "Attachment")}
            <a
              href={attachmentHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-iiw-600 underline decoration-iiw-600/30 underline-offset-2 hover:text-iiw-700"
            >
              Open / download
            </a>
          </div>
        ) : null}

        <div className="border-t border-slate-200 pt-5">
          {sectionTitle(<DocumentTextIcon className="h-4 w-4" aria-hidden />, "Signatures")}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <div className="mb-1 flex min-h-[3rem] items-end border-b-2 border-slate-800">
                <SignatureBlock data={job.staffSignature} />
              </div>
              <p className="text-xs text-slate-500">Requesting staff signature / date</p>
              <p className="mt-0.5 text-xs text-slate-400">{staff ?? ""}</p>
            </div>
            <div>
              <div className="mb-1 flex min-h-[3rem] items-end border-b-2 border-slate-800">
                <SignatureBlock data={job.interpreterSignature} />
              </div>
              <p className="text-xs text-slate-500">
                {isTrans ? "Interpreter attestation / date" : "Interpreter signature / date"}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">{job.interpreter?.name ?? ""}</p>
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 text-xs text-slate-500">
        <p>International Institute of Wisconsin — Interpretation Services</p>
        <p className="tabular-nums">
          Generated{" "}
          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
      </footer>
    </div>
  );
}
