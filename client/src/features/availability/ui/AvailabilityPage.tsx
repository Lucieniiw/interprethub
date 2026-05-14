import { type FormEvent, useEffect, useState } from "react";
import { Oval } from "react-loader-spinner";
import { LocalDateTimePicker } from "@/components/datetime/LocalDateTimePicker";
import { pairEndAfterStartChange } from "@/components/datetime/localDateTimeFormat";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import { useAuth } from "@/features/auth/model/auth-context";
import styles from "./AvailabilityPage.module.css";

type BusySlot = {
  id: number;
  startTime: string;
  endTime: string;
  reason: string | null;
  interpreter?: { id: number; name: string; email: string };
};

export function AvailabilityPage() {
  const { user } = useAuth();
  const isInterpreter = user?.role === "INTERPRETER";
  const [rows, setRows] = useState<BusySlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function handleBusyStartChange(next: string) {
    setEnd((prevEnd) =>
      pairEndAfterStartChange({
        newStartStr: next,
        previousStartStr: start.trim() ? start : null,
        currentEndStr: prevEnd,
        durationHours: 2,
      }),
    );
    setStart(next);
  }

  function load() {
    setLoading(true);
    api
      .get<BusySlot[]>("/api/busy-slots")
      .then((r) => setRows(r.data))
      .catch(() => setError("Could not load availability blocks."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!start || !end) return;
    setSaving(true);
    setError(null);
    try {
      const startIso = new Date(start).toISOString();
      const endIso = new Date(end).toISOString();
      await api.post("/api/busy-slots", {
        startTime: startIso,
        endTime: endIso,
        reason: reason.trim() || null,
      });
      setStart("");
      setEnd("");
      setReason("");
      load();
    } catch {
      setError("Could not save this block.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    try {
      await api.delete(`/api/busy-slots/${id}`);
      load();
    } catch {
      setError("Could not remove block.");
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Availability</h1>
        <p className={styles.lead}>
          {isInterpreter
            ? "Mark times you are unavailable (PTO, sick leave, etc.). Overlapping open jobs will not email you as an available linguist — blocks also appear on My schedule."
            : "All interpreter busy blocks across the team."}
        </p>
      </header>

      {isInterpreter ? (
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label}>
            Start
            <LocalDateTimePicker
              className={styles.input}
              value={start}
              onChange={handleBusyStartChange}
              required
            />
          </label>
          <label className={styles.label}>
            End
            <LocalDateTimePicker
              className={styles.input}
              value={end}
              onChange={setEnd}
              required
            />
          </label>
          <label className={styles.label}>
            Reason (optional)
            <input
              className={styles.input}
              type="text"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder="e.g. PTO, medical"
            />
          </label>
          <button className={styles.submit} type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add block"}
          </button>
        </form>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.card}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Reason</th>
              {!isInterpreter ? <th>Interpreter</th> : null}
              {isInterpreter ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={isInterpreter ? 4 : 4} className={styles.empty}>
                  No busy blocks yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.startTime).toLocaleString()}</td>
                  <td>{new Date(r.endTime).toLocaleString()}</td>
                  <td>{r.reason ?? "—"}</td>
                  {!isInterpreter ? <td>{r.interpreter?.name ?? "—"}</td> : null}
                  {isInterpreter ? (
                    <td>
                      <button type="button" className={styles.danger} onClick={() => remove(r.id)}>
                        Remove
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
