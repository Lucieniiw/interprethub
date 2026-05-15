import { useEffect, useState } from "react";
import { Oval } from "react-loader-spinner";
import { api } from "@/services/api/http-client";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { ProfilePage } from "@/features/profile/ui/ProfilePage";
import sharedStyles from "./SettingsPage.module.css";
import styles from "./LinguistSettingsPage.module.css";

type Settings = {
  cancellationPolicyHours: number;
  availableLanguages: string[];
};

export function LinguistSettingsPage() {
  const [policies, setPolicies] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Settings & { id: number }>("/settings")
      .then((r) => {
        setPolicies({
          cancellationPolicyHours: r.data.cancellationPolicyHours,
          availableLanguages: r.data.availableLanguages,
        });
      })
      .catch(() => setError("Could not load organization settings."))
      .finally(() => setLoading(false));
  }, []);

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
        <p className={styles.lead}>Workspace policies and your account</p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      {policies ? (
        <section className={sharedStyles.card} aria-label="Organization policies">
          <h2 className={styles.sectionTitle}>Organization policies</h2>
          <p className={styles.policyRow}>
            <span className={styles.policyLabel}>Cancellation notice</span>
            <span>{policies.cancellationPolicyHours} hours</span>
          </p>
          <p className={styles.policyRow}>
            <span className={styles.policyLabel}>Languages on offer</span>
            <span>{policies.availableLanguages.length ? policies.availableLanguages.join(", ") : "—"}</span>
          </p>
          <p className={styles.policyHint}>These values are managed by your coordinator team.</p>
        </section>
      ) : null}

      <ProfilePage embedded />
    </div>
  );
}
