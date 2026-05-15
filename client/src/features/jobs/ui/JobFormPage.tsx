import { useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { ArrowLeftIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate, useParams } from "react-router";
import { formatJobReference } from "@interpret-hub/shared";
import { api } from "@/services/api/http-client";
import { useAuth } from "@/features/auth/model/auth-context";
import { JobFormPrintStyleTag, JobTailwindFormSheet, type JobFormPrintJob } from "./JobTailwindFormSheet";

export function JobFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [job, setJob] = useState<JobFormPrintJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<JobFormPrintJob>(`/jobs/${id}`);
        if (!cancelled) {
          setJob(data);
          setError("");
        }
      } catch (e) {
        if (!cancelled) {
          const msg = isAxiosError(e) ? e.response?.data?.message ?? e.message : "Failed to load job";
          setError(String(msg));
          setJob(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (job) {
      document.title = `IIW Job Form — ${formatJobReference(job)}`;
    }
    return () => {
      document.title = "International Institute of Wisconsin";
    };
  }, [job]);

  if (loading) {
    return (
      <div className="job-form-root flex min-h-screen items-center justify-center bg-white font-sans">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-iiw-100 border-t-iiw-600"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="job-form-root min-h-screen bg-white px-6 py-12 font-sans text-center text-slate-900">
        <p className="text-red-600">Could not load job: {error || "Unknown error"}</p>
        <p className="mt-4">
          <Link
            to={id ? `/jobs/${id}` : "/assignments"}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeftIcon className="h-4 w-4 shrink-0" aria-hidden />
            Back to job
          </Link>
        </p>
      </div>
    );
  }

  const isStaff = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const mine = Boolean(
    user?.role === "INTERPRETER" &&
      job.interpreterId != null &&
      user != null &&
      user.id === job.interpreterId,
  );

  return (
    <div className="job-form-root min-h-screen bg-white font-sans text-slate-900 print:p-4">
      <JobFormPrintStyleTag />

      <div className="mx-auto max-w-3xl p-8">
        <div className="job-form-no-print mb-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-iiw-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-iiw-700 focus:outline-none focus:ring-2 focus:ring-iiw-500 focus:ring-offset-2"
          >
            <PrinterIcon className="h-5 w-5 shrink-0" aria-hidden />
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-iiw-500 focus:ring-offset-2"
          >
            <ArrowLeftIcon className="h-5 w-5 shrink-0 text-slate-500" aria-hidden />
            Close
          </button>
        </div>

        <JobTailwindFormSheet job={job} viewerIsStaff={isStaff} mine={mine} />
      </div>
    </div>
  );
}
