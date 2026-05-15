import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  defaultWorkspaceNotificationPreferences,
  parseWorkspaceNotificationRules,
  serializeWorkspaceNotificationPreferences,
  type WorkspaceNotificationPreferences,
} from "@interpret-hub/shared";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import { ProfilePage } from "@/features/profile/ui/ProfilePage";
import { NotificationPreferencesPanel } from "./NotificationPreferencesPanel";
import { WorkspaceUsersPanel } from "./WorkspaceUsersPanel";
import styles from "./SettingsPage.module.css";

type TabId = "account" | "notifications" | "users";

type OrgSettings = {
  id: number;
  cancellationPolicyHours: number;
  availableLanguages: string[];
  notificationRules: string | null;
  linguistPaydays: string;
};

function parseTab(raw: string | null): TabId {
  if (raw === "notifications" || raw === "users" || raw === "account") return raw;
  return "account";
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams]);

  const setTab = (next: TabId) => {
    setSearchParams(next === "account" ? {} : { tab: next }, { replace: true });
  };

  const [row, setRow] = useState<OrgSettings | null>(null);
  const [hours, setHours] = useState(24);
  const [langs, setLangs] = useState("");
  const [paydays, setPaydays] = useState("15,LAST");
  const [notifPrefs, setNotifPrefs] = useState<WorkspaceNotificationPreferences>(
    defaultWorkspaceNotificationPreferences(),
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [errorOrg, setErrorOrg] = useState<string | null>(null);
  const [errorRules, setErrorRules] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<OrgSettings>("/settings")
      .then((r) => {
        setRow(r.data);
        setHours(r.data.cancellationPolicyHours);
        setLangs(r.data.availableLanguages.join(", "));
        setNotifPrefs(parseWorkspaceNotificationRules(r.data.notificationRules));
        setPaydays(r.data.linguistPaydays ?? "15,LAST");
        setSettingsLoaded(true);
        setLoadError(null);
      })
      .catch(() => setLoadError("Could not load workspace settings."))
      .finally(() => setLoading(false));
  }, []);

  async function onSaveOrgDefaults(e: FormEvent) {
    e.preventDefault();
    setSavingOrg(true);
    setErrorOrg(null);
    try {
      const availableLanguages = langs
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const { data } = await api.patch<OrgSettings>("/settings", {
        cancellationPolicyHours: hours,
        availableLanguages,
        linguistPaydays: paydays.trim() || "15,LAST",
      });
      setRow(data);
    } catch {
      setErrorOrg("Save failed.");
    } finally {
      setSavingOrg(false);
    }
  }

  async function onSaveNotificationRules(e: FormEvent) {
    e.preventDefault();
    setSavingRules(true);
    setErrorRules(null);
    try {
      const payload = serializeWorkspaceNotificationPreferences(notifPrefs).trim();
      const { data } = await api.patch<OrgSettings>("/settings", {
        notificationRules: payload || null,
      });
      setRow(data);
      setNotifPrefs(parseWorkspaceNotificationRules(data.notificationRules));
    } catch {
      setErrorRules("Save failed.");
    } finally {
      setSavingRules(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.lead}>Account, workspace notifications, and users</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Settings sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "account"}
          className={tab === "account" ? styles.tabActive : styles.tab}
          onClick={() => setTab("account")}
        >
          Account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "notifications"}
          className={tab === "notifications" ? styles.tabActive : styles.tab}
          onClick={() => setTab("notifications")}
        >
          Notifications
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "users"}
          className={tab === "users" ? styles.tabActive : styles.tab}
          onClick={() => setTab("users")}
        >
          Users
        </button>
      </div>

      {tab === "account" ? (
        <div className={styles.panel} role="tabpanel">
          <ProfilePage embedded embeddedTitle="Personal profile" />

          <form className={styles.card} onSubmit={onSaveOrgDefaults}>
            <h2 className={styles.sectionTitle}>Organization defaults</h2>
            <p className={styles.sectionLead}>
              Policies and language catalog used when coordinators schedule jobs and linguists pick up work.
            </p>
            {loadError ? <p className={styles.warn}>{loadError}</p> : null}
            <label className={styles.label}>
              Cancellation policy (hours notice)
              <input
                className={styles.input}
                type="number"
                min={1}
                value={hours}
                onChange={(ev) => setHours(Number(ev.target.value))}
                disabled={!settingsLoaded}
              />
            </label>
            <label className={styles.label}>
              Available languages (comma-separated)
              <input
                className={styles.input}
                value={langs}
                onChange={(ev) => setLangs(ev.target.value)}
                placeholder="Spanish, French, …"
                disabled={!settingsLoaded}
              />
            </label>
            <label className={styles.label}>
              Linguist pay dates (comma-separated)
              <input
                className={styles.input}
                value={paydays}
                onChange={(ev) => setPaydays(ev.target.value)}
                placeholder="15,LAST"
                disabled={!settingsLoaded}
              />
            </label>
            {errorOrg ? <p className={styles.error}>{errorOrg}</p> : null}
            <button className={styles.submit} type="submit" disabled={savingOrg || !settingsLoaded}>
              {savingOrg ? "Saving…" : "Save organization defaults"}
            </button>
          </form>
        </div>
      ) : null}

      {tab === "notifications" ? (
        <div className={styles.panel} role="tabpanel">
          <form className={styles.card} onSubmit={onSaveNotificationRules}>
            <h2 className={styles.sectionTitle}>Workspace notifications</h2>
            <p className={styles.sectionLead}>
              Choose how the workspace sends alerts for jobs, reports, availability, and reminders. Settings apply to
              automated notifications (email, push, and in-app where implemented).
            </p>
            {loadError ? <p className={styles.warn}>{loadError}</p> : null}
            <NotificationPreferencesPanel
              value={notifPrefs}
              onChange={setNotifPrefs}
              disabled={!settingsLoaded}
            />
            {errorRules ? <p className={styles.error}>{errorRules}</p> : null}
            <button className={styles.submit} type="submit" disabled={savingRules || !settingsLoaded}>
              {savingRules ? "Saving…" : "Save notification preferences"}
            </button>
          </form>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className={styles.panel} role="tabpanel">
          <h2 className={styles.visuallyHidden}>Users</h2>
          <WorkspaceUsersPanel />
        </div>
      ) : null}
    </div>
  );
}
