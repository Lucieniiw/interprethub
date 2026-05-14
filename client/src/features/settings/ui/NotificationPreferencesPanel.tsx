import {
  REMINDER_LEAD_TIME_OPTIONS,
  sanitizeReminderLeadTimesMinutes,
  type Channels3,
  type ReminderLeadMinutes,
  type WorkspaceNotificationPreferences,
} from "@interpret-hub/shared";
import styles from "./NotificationPreferencesPanel.module.css";

function toggleLeadMinute(minutes: ReminderLeadMinutes, selected: readonly number[]): ReminderLeadMinutes[] {
  const next = new Set(sanitizeReminderLeadTimesMinutes(selected));
  if (next.has(minutes)) next.delete(minutes);
  else next.add(minutes);
  return sanitizeReminderLeadTimesMinutes([...next]);
}

function ChannelRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  value: Channels3;
  onChange: (next: Channels3) => void;
  disabled?: boolean;
}) {
  function toggle<K extends keyof Channels3>(key: K) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div className={styles.prefBlock}>
      <div className={styles.prefHead}>
        <span className={styles.prefTitle}>{title}</span>
        {description ? <span className={styles.prefDesc}>{description}</span> : null}
      </div>
      <div className={styles.channelRow} role="group" aria-label={`${title} delivery`}>
        <label className={styles.chk}>
          <input
            type="checkbox"
            checked={value.inApp}
            onChange={() => toggle("inApp")}
            disabled={disabled}
          />{" "}
          In-app
        </label>
        <label className={styles.chk}>
          <input
            type="checkbox"
            checked={value.email}
            onChange={() => toggle("email")}
            disabled={disabled}
          />{" "}
          Email
        </label>
        <label className={styles.chk}>
          <input
            type="checkbox"
            checked={value.push}
            onChange={() => toggle("push")}
            disabled={disabled}
          />{" "}
          Push
        </label>
      </div>
    </div>
  );
}

function EmailRow({
  title,
  description,
  email,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  email: boolean;
  onChange: (email: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={styles.prefBlock}>
      <div className={styles.prefHead}>
        <span className={styles.prefTitle}>{title}</span>
        {description ? <span className={styles.prefDesc}>{description}</span> : null}
      </div>
      <label className={styles.chk}>
        <input
          type="checkbox"
          checked={email}
          onChange={() => onChange(!email)}
          disabled={disabled}
        />{" "}
        Email
      </label>
    </div>
  );
}

export function NotificationPreferencesPanel({
  value,
  onChange,
  disabled,
}: {
  value: WorkspaceNotificationPreferences;
  onChange: (next: WorkspaceNotificationPreferences) => void;
  disabled?: boolean;
}) {
  function patch(partial: Partial<WorkspaceNotificationPreferences>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className={styles.root}>
      <section className={styles.section} aria-labelledby="notif-job-heading">
        <h3 id="notif-job-heading" className={styles.sectionTitle}>
          Job events
        </h3>
        <ChannelRow
          title="Accept assignment"
          value={value.acceptAssignment}
          onChange={(acceptAssignment) => patch({ acceptAssignment })}
          disabled={disabled}
        />
        <ChannelRow
          title="Decline"
          value={value.decline}
          onChange={(decline) => patch({ decline })}
          disabled={disabled}
        />
        <ChannelRow
          title="Complete"
          value={value.complete}
          onChange={(complete) => patch({ complete })}
          disabled={disabled}
        />
        <ChannelRow
          title="Withdraw"
          value={value.withdraw}
          onChange={(withdraw) => patch({ withdraw })}
          disabled={disabled}
        />
      </section>

      <section className={styles.section} aria-labelledby="notif-reports-heading">
        <h3 id="notif-reports-heading" className={styles.sectionTitle}>
          Reports
        </h3>
        <EmailRow
          title="Daily report"
          email={value.dailyReport.email}
          onChange={(email) => patch({ dailyReport: { email } })}
          disabled={disabled}
        />
        <EmailRow
          title="Weekly report"
          email={value.weeklyReport.email}
          onChange={(email) => patch({ weeklyReport: { email } })}
          disabled={disabled}
        />
      </section>

      <section className={styles.section} aria-labelledby="notif-avail-heading">
        <h3 id="notif-avail-heading" className={styles.sectionTitle}>
          Availability
        </h3>
        <ChannelRow
          title="Interpreter availability update"
          description="When an interpreter updates their availability."
          value={value.interpreterAvailabilityUpdate}
          onChange={(interpreterAvailabilityUpdate) => patch({ interpreterAvailabilityUpdate })}
          disabled={disabled}
        />
      </section>

      <section className={styles.section} aria-labelledby="notif-reminder-heading">
        <h3 id="notif-reminder-heading" className={styles.sectionTitle}>
          Reminders
        </h3>
        <ChannelRow
          title="Reminder"
          description="Reminders to interpreters about upcoming appointments and open unclaimed jobs."
          value={{
            inApp: value.reminder.inApp,
            email: value.reminder.email,
            push: value.reminder.push,
          }}
          onChange={(channels) =>
            patch({
              reminder: {
                ...value.reminder,
                ...channels,
              },
            })
          }
          disabled={disabled}
        />
        <div className={styles.prefBlock}>
          <div className={styles.prefHead}>
            <span className={styles.prefTitle}>Reminder timing</span>
            <span className={styles.prefDesc}>
              Send reminders this long before an appointment or similar event (you can choose several).
            </span>
          </div>
          <div className={styles.leadTimeGrid} role="group" aria-label="Reminder lead times">
            {REMINDER_LEAD_TIME_OPTIONS.map(({ minutes, label }) => (
              <label key={minutes} className={styles.chk}>
                <input
                  type="checkbox"
                  checked={value.reminder.reminderLeadTimesMinutes.includes(minutes)}
                  onChange={() =>
                    patch({
                      reminder: {
                        ...value.reminder,
                        reminderLeadTimesMinutes: toggleLeadMinute(
                          minutes,
                          value.reminder.reminderLeadTimesMinutes,
                        ),
                      },
                    })
                  }
                  disabled={disabled}
                />{" "}
                {label}
              </label>
            ))}
          </div>
        </div>
        <label className={styles.rulesLabel}>
          Additional notes (optional)
          <textarea
            className={styles.rulesArea}
            value={value.reminder.rulesText}
            onChange={(ev) =>
              patch({
                reminder: { ...value.reminder, rulesText: ev.target.value },
              })
            }
            disabled={disabled}
            rows={3}
            placeholder="Other reminder policies (e.g. open jobs idle for several days)."
          />
        </label>
      </section>
    </div>
  );
}
