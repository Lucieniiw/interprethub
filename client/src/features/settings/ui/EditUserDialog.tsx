import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { Oval } from "react-loader-spinner";
import { api } from "@/services/api/http-client";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import type { ViewUserRow } from "./ViewUserAccountDialog";
import inviteStyles from "./InviteUserDialog.module.css";

/** UI picks among four labels; Admin + Coordinator both map to API role ADMIN */
type UiRoleChoice = "super" | "admin" | "coord" | "interp";

function toUiRole(role: string): UiRoleChoice {
  if (role === "SUPER_ADMIN") return "super";
  if (role === "INTERPRETER") return "interp";
  return "coord";
}

function toApiRole(choice: UiRoleChoice): "SUPER_ADMIN" | "ADMIN" | "INTERPRETER" {
  if (choice === "interp") return "INTERPRETER";
  if (choice === "super") return "SUPER_ADMIN";
  return "ADMIN";
}

function apiErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const d = err.response?.data as { error?: string } | undefined;
    if (typeof d?.error === "string") return d.error;
  }
  return "Could not save changes.";
}

function parsePayRate(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function EditUserDialog({
  user,
  open,
  onClose,
  onSaved,
  canInviteSuperAdmin,
}: {
  user: ViewUserRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  canInviteSuperAdmin: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [uiRole, setUiRole] = useState<UiRoleChoice>("coord");
  const [languages, setLanguages] = useState("");
  const [phone, setPhone] = useState("");
  const [interpreterStatus, setInterpreterStatus] = useState<string>("ACTIVE");
  const [rateInPerson, setRateInPerson] = useState("0");
  const [rateVirtual, setRateVirtual] = useState("0");
  const [ratePhone, setRatePhone] = useState("0");
  const [rateMileage, setRateMileage] = useState("0");
  const [rateTravelTime, setRateTravelTime] = useState("0");
  const [ratesLoading, setRatesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && user) {
      el.showModal();
      setName(user.name);
      setEmail(user.email);
      let role = toUiRole(user.role);
      if (!canInviteSuperAdmin && role === "super") role = "coord";
      setUiRole(role);
      setLanguages(user.languages.join(", "));
      setPhone(user.phone ?? "");
      setInterpreterStatus(user.interpreterStatus ?? "ACTIVE");
      setError(null);
    } else {
      el.close();
    }
  }, [open, user, canInviteSuperAdmin]);

  useEffect(() => {
    if (!canInviteSuperAdmin && uiRole === "super") setUiRole("coord");
  }, [canInviteSuperAdmin, uiRole]);

  useEffect(() => {
    if (!open || !user) return;
    if (toApiRole(uiRole) !== "INTERPRETER") {
      setRateInPerson("0");
      setRateVirtual("0");
      setRatePhone("0");
      setRateMileage("0");
      setRateTravelTime("0");
      setRatesLoading(false);
      return;
    }
    let cancelled = false;
    setRatesLoading(true);
    api
      .get<{
        interpreterProfile: {
          rateInPerson: number;
          rateVirtual: number;
          ratePhone: number;
          rateMileage: number;
          rateTravelTime: number;
        } | null;
      }>(`/users/${user.id}`)
      .then((r) => {
        if (cancelled) return;
        const p = r.data.interpreterProfile;
        setRateInPerson(String(p?.rateInPerson ?? 0));
        setRateVirtual(String(p?.rateVirtual ?? 0));
        setRatePhone(String(p?.ratePhone ?? 0));
        setRateMileage(String(p?.rateMileage ?? 0));
        setRateTravelTime(String(p?.rateTravelTime ?? 0));
      })
      .catch(() => {
        if (!cancelled) {
          setRateInPerson("0");
          setRateVirtual("0");
          setRatePhone("0");
          setRateMileage("0");
          setRateTravelTime("0");
        }
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, user?.id, uiRole]);

  function onDialogClose() {
    if (!saving) onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const role = toApiRole(uiRole);
    if (role === "SUPER_ADMIN" && !canInviteSuperAdmin) {
      setError("You cannot assign super admin.");
      return;
    }
    const langs = languages
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      languages: langs,
      phone: phone.trim() || null,
    };

    if (role === "INTERPRETER") {
      payload.interpreterStatus = interpreterStatus;
      payload.linguistPayRates = {
        rateInPerson: parsePayRate(rateInPerson),
        rateVirtual: parsePayRate(rateVirtual),
        ratePhone: parsePayRate(ratePhone),
        rateMileage: parsePayRate(rateMileage),
        rateTravelTime: parsePayRate(rateTravelTime),
      };
    }

    setSaving(true);
    try {
      await api.patch(`/users/${user.id}`, payload);
      onSaved();
      onDialogClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const showInterpFields = toApiRole(uiRole) === "INTERPRETER";

  if (!user) return null;

  return (
    <dialog
      ref={dialogRef}
      className={inviteStyles.dialog}
      aria-labelledby={titleId}
      onClose={onDialogClose}
      onCancel={(ev) => {
        ev.preventDefault();
        onDialogClose();
      }}
    >
      <div className={inviteStyles.inner}>
        <header className={inviteStyles.head}>
          <h2 id={titleId} className={inviteStyles.title}>
            Edit user
          </h2>
          <p className={inviteStyles.sub}>Update profile and role for this workspace member.</p>
        </header>

        <form className={inviteStyles.form} onSubmit={onSubmit}>
          <label className={inviteStyles.label}>
            Full name
            <input
              className={inviteStyles.input}
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              required
              autoComplete="name"
              disabled={saving}
            />
          </label>
          <label className={inviteStyles.label}>
            Email
            <input
              className={inviteStyles.input}
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoComplete="email"
              disabled={saving}
            />
          </label>

          <div className={inviteStyles.field}>
            <span className={inviteStyles.fieldLabel}>Role</span>
            <div className={inviteStyles.roleGrid}>
              {canInviteSuperAdmin ? (
                <label className={inviteStyles.radio}>
                  <input
                    type="radio"
                    name="edit-role"
                    checked={uiRole === "super"}
                    onChange={() => setUiRole("super")}
                    disabled={saving}
                  />
                  Super admin
                </label>
              ) : null}
              <label className={inviteStyles.radio}>
                <input
                  type="radio"
                  name="edit-role"
                  checked={uiRole === "admin"}
                  onChange={() => setUiRole("admin")}
                  disabled={saving}
                />
                Admin
              </label>
              <label className={inviteStyles.radio}>
                <input
                  type="radio"
                  name="edit-role"
                  checked={uiRole === "coord"}
                  onChange={() => setUiRole("coord")}
                  disabled={saving}
                />
                Coordinator
              </label>
              <label className={inviteStyles.radio}>
                <input
                  type="radio"
                  name="edit-role"
                  checked={uiRole === "interp"}
                  onChange={() => setUiRole("interp")}
                  disabled={saving}
                />
                Interpreter
              </label>
            </div>
            <p className={inviteStyles.hint}>Admin and Coordinator use the same coordinator-level access.</p>
          </div>

          <label className={inviteStyles.label}>
            Languages <span className={inviteStyles.optional}>(optional)</span>
            <input
              className={inviteStyles.input}
              value={languages}
              onChange={(ev) => setLanguages(ev.target.value)}
              placeholder="Spanish, French…"
              disabled={saving}
            />
          </label>

          <label className={inviteStyles.label}>
            Phone <span className={inviteStyles.optional}>(optional)</span>
            <input
              className={inviteStyles.input}
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              autoComplete="tel"
              disabled={saving}
            />
          </label>

          {showInterpFields ? (
            <>
              <label className={inviteStyles.label}>
                Interpreter status
                <select
                  className={inviteStyles.input}
                  value={interpreterStatus}
                  onChange={(ev) => setInterpreterStatus(ev.target.value)}
                  disabled={saving}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="VACATION">Vacation</option>
                  <option value="SICK_LEAVE">Sick leave</option>
                </select>
              </label>

              <div className={inviteStyles.field}>
                <span className={inviteStyles.fieldLabel}>Linguist pay rates</span>
                <p className={inviteStyles.hint}>
                  Amounts your organization pays this interpreter — separate from client billing rates on the Clients page.
                </p>
                {ratesLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0" }}>
                    <Oval height={28} width={28} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
                  </div>
                ) : (
                  <>
                    <p className={inviteStyles.hint}>
                      <strong>Hourly (USD/hr)</strong>
                    </p>
                    <div className={inviteStyles.roleGrid}>
                      <label className={inviteStyles.label}>
                        In-person pay
                        <input
                          className={inviteStyles.input}
                          type="number"
                          min={0}
                          step={0.01}
                          value={rateInPerson}
                          onChange={(ev) => setRateInPerson(ev.target.value)}
                          disabled={saving}
                        />
                      </label>
                      <label className={inviteStyles.label}>
                        Virtual pay
                        <input
                          className={inviteStyles.input}
                          type="number"
                          min={0}
                          step={0.01}
                          value={rateVirtual}
                          onChange={(ev) => setRateVirtual(ev.target.value)}
                          disabled={saving}
                        />
                      </label>
                      <label className={inviteStyles.label}>
                        Phone pay
                        <input
                          className={inviteStyles.input}
                          type="number"
                          min={0}
                          step={0.01}
                          value={ratePhone}
                          onChange={(ev) => setRatePhone(ev.target.value)}
                          disabled={saving}
                        />
                      </label>
                    </div>
                    <p className={inviteStyles.hint}>
                      <strong>Mileage &amp; travel</strong>
                    </p>
                    <div className={inviteStyles.roleGrid}>
                      <label className={inviteStyles.label}>
                        Mileage pay (USD/mile)
                        <input
                          className={inviteStyles.input}
                          type="number"
                          min={0}
                          step={0.01}
                          value={rateMileage}
                          onChange={(ev) => setRateMileage(ev.target.value)}
                          disabled={saving}
                        />
                      </label>
                      <label className={inviteStyles.label}>
                        Travel time pay (USD/hr)
                        <input
                          className={inviteStyles.input}
                          type="number"
                          min={0}
                          step={0.01}
                          value={rateTravelTime}
                          onChange={(ev) => setRateTravelTime(ev.target.value)}
                          disabled={saving}
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}

          {error ? <p className={inviteStyles.error}>{error}</p> : null}

          <div className={inviteStyles.actions}>
            <button type="button" className={inviteStyles.cancel} onClick={onDialogClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={inviteStyles.submit}
              disabled={saving || (showInterpFields && ratesLoading)}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
