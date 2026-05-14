import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { api } from "@/services/api/http-client";
import inviteStyles from "@/features/settings/ui/InviteUserDialog.module.css";

function parseRate(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function AddClientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [industry, setIndustry] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rateInPerson, setRateInPerson] = useState("");
  const [ratePhone, setRatePhone] = useState("");
  const [rateVirtual, setRateVirtual] = useState("");
  const [rateMileage, setRateMileage] = useState("");
  const [rateTravelTime, setRateTravelTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
      setName("");
      setOrganization("");
      setIndustry("");
      setAddress("");
      setEmail("");
      setPhone("");
      setRateInPerson("");
      setRatePhone("");
      setRateVirtual("");
      setRateMileage("");
      setRateTravelTime("");
      setError(null);
    } else {
      el.close();
    }
  }, [open]);

  function closeDialog() {
    if (!saving) onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/clients", {
        name: name.trim(),
        organization: organization.trim() || null,
        industry: industry.trim() || null,
        address: address.trim() || null,
        email: email.trim() ? email.trim() : null,
        phone: phone.trim() || null,
        rateInPerson: parseRate(rateInPerson),
        ratePhone: parseRate(ratePhone),
        rateVirtual: parseRate(rateVirtual),
        rateMileage: parseRate(rateMileage),
        rateTravelTime: parseRate(rateTravelTime),
      });
      onCreated();
      closeDialog();
    } catch {
      setError("Could not create client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={inviteStyles.dialog}
      aria-labelledby={titleId}
      onClose={closeDialog}
      onCancel={(ev) => {
        ev.preventDefault();
        closeDialog();
      }}
    >
      <div className={inviteStyles.inner} style={{ maxHeight: "min(85vh, 760px)", overflowY: "auto" }}>
        <header className={inviteStyles.head}>
          <h2 id={titleId} className={inviteStyles.title}>
            Add new client
          </h2>
          <p className={inviteStyles.sub}>Company, contact, and invoice rates for Reports.</p>
        </header>

        <form className={inviteStyles.form} onSubmit={onSubmit}>
          <div className={inviteStyles.field}>
            <span className={inviteStyles.fieldLabel}>Contact</span>
          </div>
          <label className={inviteStyles.label}>
            Main point of contact *
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
            Company name <span className={inviteStyles.optional}>(optional)</span>
            <input
              className={inviteStyles.input}
              value={organization}
              onChange={(ev) => setOrganization(ev.target.value)}
              disabled={saving}
            />
          </label>
          <label className={inviteStyles.label}>
            Industry <span className={inviteStyles.optional}>(optional)</span>
            <input className={inviteStyles.input} value={industry} onChange={(ev) => setIndustry(ev.target.value)} disabled={saving} />
          </label>
          <label className={inviteStyles.label}>
            Address <span className={inviteStyles.optional}>(optional)</span>
            <textarea
              className={inviteStyles.input}
              rows={3}
              value={address}
              onChange={(ev) => setAddress(ev.target.value)}
              disabled={saving}
            />
          </label>
          <label className={inviteStyles.label}>
            Email <span className={inviteStyles.optional}>(optional)</span>
            <input className={inviteStyles.input} type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} disabled={saving} />
          </label>
          <label className={inviteStyles.label}>
            Phone <span className={inviteStyles.optional}>(optional)</span>
            <input className={inviteStyles.input} type="tel" value={phone} onChange={(ev) => setPhone(ev.target.value)} disabled={saving} />
          </label>

          <div className={inviteStyles.field}>
            <span className={inviteStyles.fieldLabel}>Service rates (invoice)</span>
            <p className={inviteStyles.hint}>USD amounts used when generating invoices in Reports.</p>
          </div>
          <label className={inviteStyles.label}>
            In-person
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
            Phone
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
          <label className={inviteStyles.label}>
            Virtual
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
            Mileage
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
            Travel time
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

          {error ? <p className={inviteStyles.error}>{error}</p> : null}

          <div className={inviteStyles.actions}>
            <button type="button" className={inviteStyles.cancel} onClick={closeDialog} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={inviteStyles.submit} disabled={saving}>
              {saving ? "Saving…" : "Create client"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
