import { type FormEvent, useEffect, useState } from "react";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import umStyles from "@/features/settings/ui/WorkspaceUsersPanel.module.css";
import { AddClientDialog } from "./AddClientDialog";
import { ViewClientDialog, type ClientDetail } from "./ViewClientDialog";
import styles from "./ClientsPage.module.css";

function parseRate(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" strokeWidth="2" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ClientsPage() {
  const [rows, setRows] = useState<ClientDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [viewClient, setViewClient] = useState<ClientDetail | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    organization: "",
    industry: "",
    address: "",
    email: "",
    phone: "",
    rateInPerson: "",
    ratePhone: "",
    rateVirtual: "",
    rateMileage: "",
    rateTravelTime: "",
  });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<ClientDetail[]>("/clients")
      .then((r) => setRows(r.data))
      .catch(() => setError("Could not load clients."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openView(c: ClientDetail) {
    setViewClient(c);
  }

  function closeView() {
    setViewClient(null);
  }

  function startEdit(c: ClientDetail) {
    setEditingId(c.id);
    setEditForm({
      name: c.name,
      organization: c.organization ?? "",
      industry: c.industry ?? "",
      address: c.address ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      rateInPerson: String(c.rateInPerson ?? 0),
      ratePhone: String(c.ratePhone ?? 0),
      rateVirtual: String(c.rateVirtual ?? 0),
      rateMileage: String(c.rateMileage ?? 0),
      rateTravelTime: String(c.rateTravelTime ?? 0),
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (editingId == null) return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/clients/${editingId}`, {
        name: editForm.name.trim(),
        organization: editForm.organization.trim() || null,
        industry: editForm.industry.trim() || null,
        address: editForm.address.trim() || null,
        email: editForm.email.trim() ? editForm.email.trim() : null,
        phone: editForm.phone.trim() || null,
        rateInPerson: parseRate(editForm.rateInPerson),
        ratePhone: parseRate(editForm.ratePhone),
        rateVirtual: parseRate(editForm.rateVirtual),
        rateMileage: parseRate(editForm.rateMileage),
        rateTravelTime: parseRate(editForm.rateTravelTime),
      });
      setEditingId(null);
      load();
    } catch {
      setError("Could not update client.");
    } finally {
      setSaving(false);
    }
  }

  async function removeClient(id: number) {
    if (!window.confirm("Delete this client? Jobs linked to this client must be reassigned first.")) return;
    setError(null);
    try {
      await api.delete(`/clients/${id}`);
      load();
    } catch {
      setError("Delete failed — client may still have assignments.");
    }
  }

  function subtitle(c: ClientDetail): string {
    const org = c.organization?.trim();
    if (org) return org;
    if (c.email?.trim()) return c.email;
    return "—";
  }

  if (loading && rows.length === 0) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  return (
    <div className={`${umStyles.um} ${styles.page}`}>
      <header className={umStyles.umHeader}>
        <div>
          <h1 className={umStyles.umTitle}>Clients</h1>
          <p className={styles.lead}>Organizations and contacts that request language services</p>
        </div>
        <button type="button" className={umStyles.inviteBtn} onClick={() => setAddOpen(true)}>
          <span className={umStyles.inviteIcon} aria-hidden>
            +
          </span>
          Add new client
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {editingId != null ? (
        <form className={styles.editCard} onSubmit={saveEdit}>
          <h2 className={styles.formTitle}>Edit client</h2>
          <p className={styles.editHint}>Main contact, company details, and invoice rates used in Reports.</p>
          <div className={styles.formGrid}>
            <label className={styles.label}>
              Main point of contact *
              <input
                className={styles.input}
                value={editForm.name}
                onChange={(ev) => setEditForm((f) => ({ ...f, name: ev.target.value }))}
                required
              />
            </label>
            <label className={styles.label}>
              Company name
              <input
                className={styles.input}
                value={editForm.organization}
                onChange={(ev) => setEditForm((f) => ({ ...f, organization: ev.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Industry
              <input className={styles.input} value={editForm.industry} onChange={(ev) => setEditForm((f) => ({ ...f, industry: ev.target.value }))} />
            </label>
            <label className={`${styles.label} ${styles.full}`}>
              Address
              <textarea
                className={styles.textarea}
                rows={3}
                value={editForm.address}
                onChange={(ev) => setEditForm((f) => ({ ...f, address: ev.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Email
              <input
                className={styles.input}
                type="email"
                value={editForm.email}
                onChange={(ev) => setEditForm((f) => ({ ...f, email: ev.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Phone
              <input
                className={styles.input}
                type="tel"
                value={editForm.phone}
                onChange={(ev) => setEditForm((f) => ({ ...f, phone: ev.target.value }))}
              />
            </label>
            <span className={styles.rateSectionLabel}>Service rates (USD)</span>
            <label className={styles.label}>
              In-person
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.01}
                value={editForm.rateInPerson}
                onChange={(ev) => setEditForm((f) => ({ ...f, rateInPerson: ev.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Phone
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.01}
                value={editForm.ratePhone}
                onChange={(ev) => setEditForm((f) => ({ ...f, ratePhone: ev.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Virtual
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.01}
                value={editForm.rateVirtual}
                onChange={(ev) => setEditForm((f) => ({ ...f, rateVirtual: ev.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Mileage
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.01}
                value={editForm.rateMileage}
                onChange={(ev) => setEditForm((f) => ({ ...f, rateMileage: ev.target.value }))}
              />
            </label>
            <label className={styles.label}>
              Travel time
              <input
                className={styles.input}
                type="number"
                min={0}
                step={0.01}
                value={editForm.rateTravelTime}
                onChange={(ev) => setEditForm((f) => ({ ...f, rateTravelTime: ev.target.value }))}
              />
            </label>
          </div>
          <div className={styles.editActions}>
            <button className={styles.submit} type="submit" disabled={saving}>
              Save
            </button>
            <button type="button" className={styles.cancelBtn} onClick={() => setEditingId(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className={umStyles.tableWrap}>
        <table className={umStyles.table}>
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Email</th>
              <th scope="col">Phone</th>
              <th scope="col" className={umStyles.thActions}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  No clients yet. Use &quot;Add new client&quot; to create one.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className={umStyles.userCell}>
                      <span className={umStyles.avatar} aria-hidden>
                        {initials(c.name)}
                      </span>
                      <div className={umStyles.userText}>
                        <span className={umStyles.userName}>{c.name}</span>
                        <span className={umStyles.userEmail}>{subtitle(c)}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={umStyles.lastActive}>{c.email?.trim() || "—"}</span>
                  </td>
                  <td>
                    <span className={umStyles.lastActive}>{c.phone?.trim() || "—"}</span>
                  </td>
                  <td>
                    <div className={umStyles.actions}>
                      <button
                        type="button"
                        className={umStyles.iconBtn}
                        title="View"
                        aria-label="View client"
                        onClick={() => openView(c)}
                      >
                        <IconEye />
                      </button>
                      <button
                        type="button"
                        className={umStyles.iconBtn}
                        title="Edit"
                        aria-label="Edit client"
                        onClick={() => startEdit(c)}
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        className={`${umStyles.iconBtn} ${umStyles.iconBtnDanger}`}
                        title="Delete"
                        aria-label="Delete client"
                        onClick={() => void removeClient(c.id)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddClientDialog open={addOpen} onClose={() => setAddOpen(false)} onCreated={load} />

      <ViewClientDialog client={viewClient} open={viewClient != null} onClose={closeView} />
    </div>
  );
}
