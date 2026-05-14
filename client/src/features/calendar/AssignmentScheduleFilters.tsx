import {
  SCHEDULE_STATUS_OPTIONS,
  type JobForScheduleFilter,
  uniqueClientsFromJobs,
  uniqueInterpretersFromJobs,
} from "./jobScheduleSearch";
import styles from "./AssignmentScheduleFilters.module.css";

export type ScheduleFilterState = {
  search: string;
  status: string;
  clientId: string;
  interpreterId: string;
};

const DEFAULT_FILTERS: ScheduleFilterState = {
  search: "",
  status: "",
  clientId: "",
  interpreterId: "",
};

export function getDefaultScheduleFilters(): ScheduleFilterState {
  return { ...DEFAULT_FILTERS };
}

type Props = {
  /** Full job list (unfiltered) — used to populate client & interpreter dropdowns */
  jobsForOptions: JobForScheduleFilter[];
  filters: ScheduleFilterState;
  onFiltersChange: (next: ScheduleFilterState) => void;
  /** Hide interpreter dropdown on My schedule (single linguist) */
  showInterpreterFilter: boolean;
  idPrefix: string;
};

export function AssignmentScheduleFilters({
  jobsForOptions,
  filters,
  onFiltersChange,
  showInterpreterFilter,
  idPrefix,
}: Props) {
  const clients = uniqueClientsFromJobs(jobsForOptions);
  const interpreters = uniqueInterpretersFromJobs(jobsForOptions);

  function patch(partial: Partial<ScheduleFilterState>) {
    onFiltersChange({ ...filters, ...partial });
  }

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.status !== "" ||
    filters.clientId !== "" ||
    (showInterpreterFilter && filters.interpreterId !== "");

  return (
    <div className={styles.toolbar} role="search" aria-label="Search and filter assignments">
      <label className={styles.searchWrap} htmlFor={`${idPrefix}-search`}>
        <span className={styles.visuallyHidden}>Search</span>
        <input
          id={`${idPrefix}-search`}
          type="search"
          className={styles.searchInput}
          placeholder="Search by ID, job code, client, interpreter, consumer, requester…"
          value={filters.search}
          onChange={(ev) => patch({ search: ev.target.value })}
          autoComplete="off"
        />
      </label>

      <div className={styles.filtersRow}>
        <label className={styles.filterLabel} htmlFor={`${idPrefix}-status`}>
          Status
          <select
            id={`${idPrefix}-status`}
            className={styles.select}
            value={filters.status}
            onChange={(ev) => patch({ status: ev.target.value })}
          >
            {SCHEDULE_STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterLabel} htmlFor={`${idPrefix}-client`}>
          Client
          <select
            id={`${idPrefix}-client`}
            className={styles.select}
            value={filters.clientId}
            onChange={(ev) => patch({ clientId: ev.target.value })}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {showInterpreterFilter ? (
          <label className={styles.filterLabel} htmlFor={`${idPrefix}-interpreter`}>
            Interpreter
            <select
              id={`${idPrefix}-interpreter`}
              className={styles.select}
              value={filters.interpreterId}
              onChange={(ev) => patch({ interpreterId: ev.target.value })}
            >
              <option value="">All interpreters</option>
              {interpreters.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {hasActiveFilters ? (
          <button type="button" className={styles.clearBtn} onClick={() => onFiltersChange(getDefaultScheduleFilters())}>
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ScheduleFilterEmptyBanner({
  show,
  message = "No assignments match your search or filters.",
}: {
  show: boolean;
  message?: string;
}) {
  if (!show) return null;
  return <p className={styles.filterEmpty}>{message}</p>;
}
