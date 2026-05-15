import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router";
import { LocalDateTimePicker } from "@/components/datetime/LocalDateTimePicker";
import {
  addHoursToLocalWallTime,
  formatLocalDateTimeInput,
  pairEndAfterStartChange,
  parseLocalDateTimeInput,
} from "@/components/datetime/localDateTimeFormat";
import { interpretationSessionMinDurationMessage } from "@interpret-hub/shared";
import { api } from "@/services/api/http-client";
import styles from "./CreateJobPage.module.css";

type Client = { id: number; name: string };

type UserRow = {
  id: number;
  name: string;
  role: string;
  accountLocked: boolean;
};

type ServiceCategory = "INTERPRETATION" | "TRANSLATION";

export function CreateJobPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [serviceCategory, setServiceCategory] = useState<ServiceCategory>("INTERPRETATION");

  const [language, setLanguage] = useState("Spanish");
  const [serviceType, setServiceType] = useState("IN_PERSON");
  const [interpretationDomain, setInterpretationDomain] = useState("IMMIGRATION");
  const [clientId, setClientId] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [endLocal, setEndLocal] = useState("");
  const [appointmentAddress, setAppointmentAddress] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [interpNotes, setInterpNotes] = useState("");

  const [originalLanguage, setOriginalLanguage] = useState("English");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [flatRate, setFlatRate] = useState("");
  const [rushFee, setRushFee] = useState("");
  const [dueLocal, setDueLocal] = useState("");
  const [translationClientName, setTranslationClientName] = useState("");
  const [transNotes, setTransNotes] = useState("");

  const [linguists, setLinguists] = useState<{ id: number; name: string }[]>([]);
  const [assignToId, setAssignToId] = useState("");

  const attachmentRef = useRef<HTMLInputElement>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function interpretationDefaultHours(): number {
    return serviceType === "IN_PERSON" ? 2 : 1;
  }

  function handleInterpretationStartChange(next: string) {
    setEndLocal((prevEnd) =>
      pairEndAfterStartChange({
        newStartStr: next,
        previousStartStr: startLocal.trim() ? startLocal : null,
        currentEndStr: prevEnd,
        durationHours: interpretationDefaultHours(),
      }),
    );
    setStartLocal(next);
  }

  useEffect(() => {
    if (serviceCategory !== "INTERPRETATION") return;
    const st = parseLocalDateTimeInput(startLocal);
    const en = parseLocalDateTimeInput(endLocal);
    if (!st || !en) return;
    const svc = serviceType as "IN_PERSON" | "VIRTUAL" | "PHONE";
    const msg = interpretationSessionMinDurationMessage(svc, st.getTime(), en.getTime());
    if (msg) {
      const hours = interpretationDefaultHours();
      setEndLocal(formatLocalDateTimeInput(addHoursToLocalWallTime(st, hours)));
    }
  }, [serviceType, serviceCategory]);

  useEffect(() => {
    api
      .get<Client[]>("/clients")
      .then((r) => setClients(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get<UserRow[]>("/users")
      .then((r) => {
        setLinguists(
          r.data
            .filter((u) => u.role === "INTERPRETER" && !u.accountLocked)
            .map((u) => ({ id: u.id, name: u.name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let payload: Record<string, unknown>;

      if (serviceCategory === "INTERPRETATION") {
        if (!startLocal || !endLocal) {
          setError("Session start and end are required.");
          setSaving(false);
          return;
        }
        const st = new Date(startLocal).getTime();
        const en = new Date(endLocal).getTime();
        const durMsg = interpretationSessionMinDurationMessage(
          serviceType as "IN_PERSON" | "VIRTUAL" | "PHONE",
          st,
          en,
        );
        if (durMsg) {
          setError(durMsg);
          setSaving(false);
          return;
        }
        payload = {
          serviceCategory: "INTERPRETATION",
          language: language.trim(),
          serviceType,
          interpretationType: interpretationDomain,
          clientId: clientId ? Number(clientId) : null,
          startTime: new Date(startLocal).toISOString(),
          endTime: new Date(endLocal).toISOString(),
          location: appointmentAddress.trim() || null,
          recipientName: recipientName.trim() || null,
          requesterName: requesterName.trim() || null,
          notes: interpNotes.trim() || null,
          rate: 0,
          interpreterId: assignToId ? Number(assignToId) : null,
        };
      } else {
        if (!dueLocal) {
          setError("Due date is required.");
          setSaving(false);
          return;
        }
        const rateNum = Number(flatRate);
        if (!Number.isFinite(rateNum) || rateNum < 0) {
          setError("Enter a valid flat rate.");
          setSaving(false);
          return;
        }
        const rushNum = rushFee.trim() === "" ? null : Number(rushFee);
        if (rushNum !== null && (!Number.isFinite(rushNum) || rushNum < 0)) {
          setError("Enter a valid rush fee or leave it blank.");
          setSaving(false);
          return;
        }
        payload = {
          serviceCategory: "TRANSLATION",
          language: originalLanguage.trim(),
          targetLanguage: targetLanguage.trim(),
          rate: rateNum,
          rushFee: rushNum,
          translationDueDate: new Date(dueLocal).toISOString(),
          translationClientName: translationClientName.trim() || null,
          clientId: clientId ? Number(clientId) : null,
          notes: transNotes.trim() || null,
          interpreterId: assignToId ? Number(assignToId) : null,
        };
      }

      if (attachmentFile) {
        const fd = new FormData();
        fd.append("payload", JSON.stringify(payload));
        fd.append("attachment", attachmentFile);
        await api.post("/jobs", fd, { timeout: 120_000 });
      } else {
        await api.post("/jobs", payload);
      }
      navigate("/assignments", { replace: true });
    } catch (err: unknown) {
      let msg = "Could not create assignment. Check required fields and try again.";
      if (axios.isAxiosError(err)) {
        const d = err.response?.data as { error?: unknown } | undefined;
        if (typeof d?.error === "string") msg = d.error;
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const interpDurationCheck = useMemo(() => {
    if (serviceCategory !== "INTERPRETATION") return null;
    const st = parseLocalDateTimeInput(startLocal);
    const en = parseLocalDateTimeInput(endLocal);
    if (!st || !en) return null;
    return interpretationSessionMinDurationMessage(
      serviceType as "IN_PERSON" | "VIRTUAL" | "PHONE",
      st.getTime(),
      en.getTime(),
    );
  }, [serviceCategory, startLocal, endLocal, serviceType]);

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>New assignment</h1>
        <p className={styles.pageLead}>
          Create an interpretation or translation assignment. A job reference is assigned when you save.
        </p>
      </header>

      <form className={styles.card} onSubmit={onSubmit}>
        <h2 className={styles.h2}>Assignment details</h2>

        <div className={styles.formSection}>
          <h3 className={styles.formSectionTitle}>Type</h3>
          <div className={styles.radioBar}>
            <label>
              <input
                type="radio"
                name="svc"
                checked={serviceCategory === "INTERPRETATION"}
                onChange={() => setServiceCategory("INTERPRETATION")}
              />
              Interpretation
            </label>
            <label>
              <input
                type="radio"
                name="svc"
                checked={serviceCategory === "TRANSLATION"}
                onChange={() => setServiceCategory("TRANSLATION")}
              />
              Translation
            </label>
          </div>
        </div>

        {serviceCategory === "INTERPRETATION" ? (
          <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}>Interpretation</h3>
            <div className={styles.grid}>
              <label className={styles.label}>
                Language
                <input
                  className={styles.input}
                  value={language}
                  onChange={(ev) => setLanguage(ev.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                Modality
                <select className={styles.input} value={serviceType} onChange={(ev) => setServiceType(ev.target.value)}>
                  <option value="IN_PERSON">In person</option>
                  <option value="VIRTUAL">Virtual</option>
                  <option value="PHONE">Phone</option>
                </select>
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Interpretation domain
                <select
                  className={styles.input}
                  value={interpretationDomain}
                  onChange={(ev) => setInterpretationDomain(ev.target.value)}
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
                  value={startLocal}
                  onChange={handleInterpretationStartChange}
                  required
                />
              </label>
              <label className={styles.label}>
                Session end
                <LocalDateTimePicker className={styles.input} value={endLocal} onChange={setEndLocal} required />
              </label>
              <p className={`${styles.help} ${styles.full}`}>
                Minimum duration: 2 hours in person; 1 hour phone or virtual.
              </p>
              {interpDurationCheck ? (
                <p className={`${styles.fieldHintWarn} ${styles.full}`} role="status">
                  {interpDurationCheck}
                </p>
              ) : startLocal.trim() && endLocal.trim() ? (
                <p className={`${styles.fieldHintOk} ${styles.full}`} role="status">
                  Session length meets the minimum for this modality.
                </p>
              ) : null}
              <label className={`${styles.label} ${styles.full}`}>
                Client / organization
                <select className={styles.input} value={clientId} onChange={(ev) => setClientId(ev.target.value)}>
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Location
                <textarea
                  className={styles.textarea}
                  value={appointmentAddress}
                  onChange={(ev) => setAppointmentAddress(ev.target.value)}
                  rows={3}
                  placeholder="Site address or virtual meeting details"
                />
              </label>
              <label className={styles.label}>
                Assign to interpreter
                <select className={styles.input} value={assignToId} onChange={(ev) => setAssignToId(ev.target.value)}>
                  <option value="">Unassigned — post as OPEN</option>
                  {linguists.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Status (on save)
                <input className={styles.input} readOnly value={assignToId ? "ASSIGNED" : "OPEN"} />
              </label>
              <label className={styles.label}>
                Consumer / recipient
                <input
                  className={styles.input}
                  value={recipientName}
                  onChange={(ev) => setRecipientName(ev.target.value)}
                />
              </label>
              <label className={styles.label}>
                Requester name
                <input
                  className={styles.input}
                  value={requesterName}
                  onChange={(ev) => setRequesterName(ev.target.value)}
                />
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Internal notes
                <textarea
                  className={styles.textarea}
                  value={interpNotes}
                  onChange={(ev) => setInterpNotes(ev.target.value)}
                  rows={3}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}>Translation</h3>
            <div className={styles.grid}>
              <label className={styles.label}>
                Original language
                <input
                  className={styles.input}
                  value={originalLanguage}
                  onChange={(ev) => setOriginalLanguage(ev.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                Target language
                <input
                  className={styles.input}
                  value={targetLanguage}
                  onChange={(ev) => setTargetLanguage(ev.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                Flat rate (USD)
                <input
                  className={styles.input}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={flatRate}
                  onChange={(ev) => setFlatRate(ev.target.value)}
                  required
                />
              </label>
              <label className={styles.label}>
                Rush fee (USD, optional)
                <input
                  className={styles.input}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={rushFee}
                  onChange={(ev) => setRushFee(ev.target.value)}
                />
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Due date
                <LocalDateTimePicker className={styles.input} value={dueLocal} onChange={setDueLocal} required />
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Client / organization
                <select className={styles.input} value={clientId} onChange={(ev) => setClientId(ev.target.value)}>
                  <option value="">—</option>
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Client name (matter)
                <input
                  className={styles.input}
                  value={translationClientName}
                  onChange={(ev) => setTranslationClientName(ev.target.value)}
                  placeholder="Optional subject name"
                />
              </label>
              <label className={styles.label}>
                Assign to interpreter
                <select className={styles.input} value={assignToId} onChange={(ev) => setAssignToId(ev.target.value)}>
                  <option value="">Unassigned — post as OPEN</option>
                  {linguists.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.label}>
                Status (on save)
                <input className={styles.input} readOnly value={assignToId ? "ASSIGNED" : "OPEN"} />
              </label>
              <label className={`${styles.label} ${styles.full}`}>
                Internal notes
                <textarea
                  className={styles.textarea}
                  value={transNotes}
                  onChange={(ev) => setTransNotes(ev.target.value)}
                  rows={3}
                />
              </label>
            </div>
          </div>
        )}

        <details className={styles.advanced}>
          <summary className={styles.advancedSummary}>Attachment (optional)</summary>
          <p className={styles.help}>PDF, Word, Excel, images, text, or ZIP — max 15 MB.</p>
          <div className={styles.fileRow}>
            <input
              ref={attachmentRef}
              type="file"
              className={styles.fileHidden}
              accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.ppt,.pptx,.zip"
              onChange={(ev) => setAttachmentFile(ev.target.files?.[0] ?? null)}
            />
            <button type="button" className={styles.filePickBtn} onClick={() => attachmentRef.current?.click()}>
              Choose file…
            </button>
            <span className={styles.fileName} aria-live="polite">
              {attachmentFile ? attachmentFile.name : "No file selected"}
            </span>
            {attachmentFile ? (
              <button
                type="button"
                className={styles.fileClear}
                onClick={() => {
                  setAttachmentFile(null);
                  if (attachmentRef.current) attachmentRef.current.value = "";
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </details>

        {error ? (
          <p className={styles.errorBanner} role="alert" aria-live="polite">
            {error}
          </p>
        ) : null}

        <div className={styles.stickyActionsBar}>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className={styles.primary} disabled={saving}>
              {saving ? "Creating…" : "Create assignment"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
