/** Shared shape for CSV / print export (matches GET /api/jobs list rows). */
import { formatJobReference } from "@interpret-hub/shared";

export type ExportableAssignment = {
  id: number;
  jobCode: string | null;
  language: string;
  targetLanguage: string | null;
  serviceCategory: string;
  location: string | null;
  startTime: string;
  endTime: string;
  status: string;
  /** NONE | PENDING_REVIEW | APPROVED | DISPUTED — from GET /api/jobs when present */
  completionStatus?: string | null;
  recipientName: string | null;
  requesterName: string | null;
  translationClientName: string | null;
  client?: { id: number; name: string } | null;
  interpreter?: { id: number; name: string } | null;
};

function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function categoryLabel(c: string): string {
  if (c === "INTERPRETATION") return "Interpretation";
  if (c === "TRANSLATION") return "Translation";
  return c;
}

function languageLine(j: ExportableAssignment): string {
  if (j.serviceCategory === "TRANSLATION" && j.targetLanguage) {
    return `${j.language} → ${j.targetLanguage}`;
  }
  return j.language;
}

export function assignmentsToCsv(jobs: ExportableAssignment[]): string {
  const headers = [
    "Job ID",
    "Category",
    "Status",
    "Completion review",
    "Language",
    "Start",
    "End",
    "Client",
    "Interpreter",
    "Consumer / subject",
    "Requester",
    "Location",
  ];
  const rows = jobs.map((j) =>
    [
      formatJobReference(j),
      categoryLabel(j.serviceCategory),
      j.status,
      j.completionStatus && j.completionStatus !== "NONE" ? j.completionStatus : "",
      languageLine(j),
      new Date(j.startTime).toLocaleString(),
      new Date(j.endTime).toLocaleString(),
      j.client?.name ?? "",
      j.interpreter?.name ?? "",
      j.recipientName ?? j.translationClientName ?? "",
      j.requesterName ?? "",
      j.location ?? "",
    ].map((cell) => csvEscape(cell)),
  );
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["\ufeff", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSingleAssignmentPrintDocument(j: ExportableAssignment, title: string): string {
  const ref = formatJobReference(j);
  const consumer = j.recipientName ?? j.translationClientName ?? "—";
  const rows: [string, string][] = [
    ["Job ID", ref],
    ["Category", categoryLabel(j.serviceCategory)],
    ["Status", j.status],
    ...(j.completionStatus && j.completionStatus !== "NONE"
      ? ([["Completion review", j.completionStatus]] as [string, string][])
      : []),
    ["Language", languageLine(j)],
    ["Start", new Date(j.startTime).toLocaleString()],
    ["End", new Date(j.endTime).toLocaleString()],
    ["Client", j.client?.name ?? "—"],
    ["Interpreter", j.interpreter?.name ?? "—"],
    ["Consumer / subject", consumer],
    ["Requester", j.requesterName ?? "—"],
    ["Location", j.location ?? "—"],
  ];
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><th style="text-align:left;padding:6px 12px 6px 0;border-bottom:1px solid #e2e8f0;color:#64748b">${k}</th><td style="padding:6px 0;border-bottom:1px solid #e2e8f0">${escapeHtml(v)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
@page { margin: 12mm; }
html, body { height: auto; margin: 0; }
body{font-family:system-ui,sans-serif;padding:0;color:#0f172a;max-width:40rem}
</style></head>
<body><h1 style="font-size:1.25rem;margin:0 0 1rem">${escapeHtml(title)}</h1>
<table style="width:100%;border-collapse:collapse;font-size:14px">${body}</table>
<p style="margin-top:1.5rem;font-size:12px;color:#64748b">InterpreterHub</p>
</body></html>`;
}

/**
 * Opens the system print dialog without a pop-up window (avoids `noopener` null refs and many blockers).
 * Falls back to a new tab if iframe printing is unavailable.
 */
export function printHtmlDocument(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Print");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    printHtmlInNewTabFallback(html);
    return;
  }
  const doc = win.document;
  try {
    doc.open();
    doc.write(html);
    doc.close();
  } catch {
    iframe.remove();
    printHtmlInNewTabFallback(html);
    return;
  }

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    } finally {
      const detach = () => {
        try {
          iframe.remove();
        } catch {
          /* ignore */
        }
      };
      win.addEventListener("afterprint", detach, { once: true });
      setTimeout(detach, 4000);
    }
  };

  if (doc.readyState === "complete") {
    runPrint();
  } else {
    win.addEventListener("load", runPrint, { once: true });
  }
}

function printHtmlInNewTabFallback(html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    window.alert(
      "Printing could not start. If your browser blocked a pop-up, allow pop-ups for this site and try again.",
    );
    return;
  }
  const revoke = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };
  w.addEventListener("afterprint", revoke, { once: true });
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      revoke();
    }
    setTimeout(revoke, 60_000);
  }, 250);
}

export function printAssignmentInNewWindow(j: ExportableAssignment) {
  const ref = formatJobReference(j);
  const html = buildSingleAssignmentPrintDocument(j, ref);
  printHtmlDocument(html);
}
