import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api/http-client";
import styles from "./NotificationBell.module.css";

type N = {
  id: number;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [count, setCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const { data: list } = await api.get<N[]>("/notifications");
      setItems(list);
    } catch {
      /* ignore */
    }
    try {
      const { data: c } = await api.get<{ count: number }>("/notifications/unread-count");
      setCount(typeof c?.count === "number" ? c.count : 0);
    } catch {
      setCount(0);
    }
  }

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!rootRef.current?.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  async function onReadOne(id: number) {
    await api.patch(`/notifications/${id}/read`);
    void refresh();
  }

  async function onReadAll() {
    await api.post("/notifications/read-all");
    void refresh();
    setOpen(false);
  }

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={styles.bell}
        aria-label="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
          if (!open) void refresh();
        }}
      >
        🔔
        {count > 0 ? <span className={styles.badge}>{count > 9 ? "9+" : count}</span> : null}
      </button>
      {open ? (
        <div className={styles.dropdown}>
          <div className={styles.head}>
            <span>Notifications</span>
            <button type="button" className={styles.linkBtn} onClick={() => void onReadAll()}>
              Mark all read
            </button>
          </div>
          <ul className={styles.list}>
            {items.length === 0 ? (
              <li className={styles.empty}>No notifications</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className={n.read ? styles.read : styles.unread}>
                  <button
                    type="button"
                    className={styles.itemBtn}
                    onClick={() => void onReadOne(n.id)}
                  >
                    <span className={styles.msg}>{n.message}</span>
                    <span className={styles.time}>{new Date(n.createdAt).toLocaleString()}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
