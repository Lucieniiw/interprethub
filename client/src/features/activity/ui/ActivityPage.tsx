import { useEffect, useState } from "react";
import { Oval } from "react-loader-spinner";
import { IIW_BLUE, IIW_LOADER_SECONDARY } from "@/theme/iiw";
import { api } from "@/services/api/http-client";
import styles from "./ActivityPage.module.css";

type Row = {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  user: { id: number; name: string; email: string } | null;
};

export function ActivityPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Row[]>("/activity")
      .then((r) => setRows(r.data))
      .catch(() => setError("Could not load activity."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.loader}>
        <Oval height={42} width={42} color={IIW_BLUE} secondaryColor={IIW_LOADER_SECONDARY} />
      </div>
    );
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Activity</h1>
        <p className={styles.lead}>Recent actions across jobs and assignments</p>
      </header>

      <ul className={styles.list}>
        {rows.map((a) => (
          <li key={a.id} className={styles.item}>
            <div className={styles.msg}>{a.message}</div>
            <div className={styles.meta}>
              <span className={styles.type}>{a.type}</span>
              {a.user ? <span>{a.user.name}</span> : null}
              <span>{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
