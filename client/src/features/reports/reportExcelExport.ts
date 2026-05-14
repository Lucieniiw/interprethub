import { formatJobReference } from "@interpret-hub/shared";

/** Matches GET /api/reports/jobs-for-export row shape */
export type ReportExportJob = {
  id: number;
  jobCode: string | null;
  language: string;
  targetLanguage: string | null;
  serviceCategory: string;
  serviceType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | null;
  location: string | null;
  recipientName: string | null;
  patientName: string | null;
  translationClientName: string | null;
  requesterName: string | null;
  interpreterMileage: number | null;
  interpreterTravelTime: number | null;
  interpreterTravelOutsideCounty: boolean | null;
  client: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    organization: string | null;
    industry: string | null;
    address: string | null;
    rateInPerson: number;
    ratePhone: number;
    rateVirtual: number;
    rateMileage: number;
    rateTravelTime: number;
  } | null;
  interpreter: {
    id: number;
    name: string;
    email: string;
    interpreterProfile: {
      rateInPerson: number;
      rateVirtual: number;
      ratePhone: number;
      rateMileage: number;
      rateTravelTime: number;
    } | null;
  } | null;
};

export type ReportKind = "invoice" | "bill" | "customer_lead";

function consumerName(j: ReportExportJob): string {
  return j.recipientName ?? j.patientName ?? j.translationClientName ?? "—";
}

function buildDescription(j: ReportExportJob): string {
  const consumer = consumerName(j);
  const requester = j.requesterName ?? "—";
  const start = new Date(j.startTime);
  const dateStr = start.toLocaleDateString(undefined, { dateStyle: "long" });
  const timeStr = start.toLocaleTimeString(undefined, { timeStyle: "short" });

  if (j.serviceCategory === "TRANSLATION") {
    const lang = j.targetLanguage ? `${j.language} → ${j.targetLanguage}` : j.language;
    return `${lang} translation service for ${consumer} (due ${dateStr}) requested by ${requester}`;
  }

  return `${j.language} Interpretation service for ${consumer} on ${dateStr} at ${timeStr} requested by ${requester}`;
}

function totalHoursNumber(j: ReportExportJob): number {
  if (j.durationMinutes != null && j.durationMinutes > 0) {
    return Math.round((j.durationMinutes / 60) * 100) / 100;
  }
  const a = new Date(j.startTime).getTime();
  const b = new Date(j.endTime).getTime();
  if (!Number.isNaN(a) && !Number.isNaN(b) && b > a) {
    return Math.round(((b - a) / 3600000) * 100) / 100;
  }
  return 0;
}

type PayRateProfile = {
  rateInPerson: number;
  rateVirtual: number;
  ratePhone: number;
  rateMileage: number;
  rateTravelTime: number;
};

const ZERO_PAY_RATES: PayRateProfile = {
  rateInPerson: 0,
  rateVirtual: 0,
  ratePhone: 0,
  rateMileage: 0,
  rateTravelTime: 0,
};

function payRatesFromClient(c: NonNullable<ReportExportJob["client"]>): PayRateProfile {
  return {
    rateInPerson: c.rateInPerson,
    rateVirtual: c.rateVirtual,
    ratePhone: c.ratePhone,
    rateMileage: c.rateMileage,
    rateTravelTime: c.rateTravelTime,
  };
}

function payRatesFromInterpreter(i: NonNullable<ReportExportJob["interpreter"]>): PayRateProfile {
  const p = i.interpreterProfile;
  if (!p) return { ...ZERO_PAY_RATES };
  return {
    rateInPerson: p.rateInPerson,
    rateVirtual: p.rateVirtual,
    ratePhone: p.ratePhone,
    rateMileage: p.rateMileage,
    rateTravelTime: p.rateTravelTime,
  };
}

/** Hourly pay/bill rate from modality + category against a rate profile (client or interpreter). */
function hourlyRateFromPayProfile(j: ReportExportJob, p: PayRateProfile): number {
  if (j.serviceCategory === "TRANSLATION") {
    if (p.rateVirtual > 0) return p.rateVirtual;
    return p.rateInPerson;
  }
  switch (j.serviceType) {
    case "VIRTUAL":
      return p.rateVirtual;
    case "PHONE":
      return p.ratePhone;
    case "IN_PERSON":
    default:
      return p.rateInPerson;
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatUsDateFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US");
}

function formatUsDateFromIso(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US");
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function travelApplicable(j: ReportExportJob): boolean {
  return (
    (j.interpreterTravelTime != null && j.interpreterTravelTime > 0) ||
    j.interpreterTravelOutsideCounty === true
  );
}

function mileageApplicable(j: ReportExportJob): boolean {
  return j.interpreterMileage != null && j.interpreterMileage > 0;
}

/** Billable travel hours (0 if no positive minutes on file). */
function travelHoursNumber(j: ReportExportJob): number {
  const m = j.interpreterTravelTime;
  if (m == null || m <= 0) return 0;
  return Math.round((m / 60) * 100) / 100;
}

type QbLineDef = {
  item: string;
  description: string;
  quantity: number;
  rate: number;
  serviceDate: string;
};

/** QuickBooks Item(Product/Service) name: e.g. `Spanish Interpretation` or translation line. */
function quickBooksProductServiceName(j: ReportExportJob): string {
  if (j.serviceCategory === "TRANSLATION") {
    return j.targetLanguage ? `${j.language} → ${j.targetLanguage} translation` : `${j.language} translation`;
  }
  return `${j.language} Interpretation`;
}

function collectLinesForPayProfile(j: ReportExportJob, rates: PayRateProfile): QbLineDef[] {
  const lines: QbLineDef[] = [];
  const svcDate = formatUsDateFromIso(j.startTime);
  const hrs = totalHoursNumber(j);
  if (hrs > 0) {
    lines.push({
      item: quickBooksProductServiceName(j),
      description: buildDescription(j),
      quantity: hrs,
      rate: hourlyRateFromPayProfile(j, rates),
      serviceDate: svcDate,
    });
  }
  if (mileageApplicable(j)) {
    const mi = j.interpreterMileage!;
    lines.push({
      item: "Mileage",
      description: "Mileage",
      quantity: mi,
      rate: rates.rateMileage,
      serviceDate: svcDate,
    });
  }
  const travelH = travelHoursNumber(j);
  if (travelApplicable(j) && travelH > 0) {
    lines.push({
      item: "Travel Time",
      description: "Travel Time",
      quantity: travelH,
      rate: rates.rateTravelTime,
      serviceDate: svcDate,
    });
  }
  return lines;
}

function collectLinesForJob(j: ReportExportJob, c: NonNullable<ReportExportJob["client"]>): QbLineDef[] {
  return collectLinesForPayProfile(j, payRatesFromClient(c));
}

/** QuickBooks-style column headers (import / spreadsheet template). */
const QUICKBOOKS_INVOICE_HEADER = [
  "*InvoiceNo",
  "*Customer",
  "*InvoiceDate",
  "*DueDate",
  "Terms",
  "Location",
  "Memo",
  "Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "*ItemAmount",
  "Service Date",
];

const QUICKBOOKS_BILL_HEADER = [
  "*BillNo",
  "*Supplier",
  "*BillDate",
  "*DueDate",
  "Terms",
  "Location",
  "Memo",
  "Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "*ItemAmount",
  "Service Date",
];

export type ReportInvoiceDateRange = { fromDate: string; toDate: string };

export type ReportExportExcelOptions = {
  /** Bill / invoice dates and memo (report date range). */
  invoiceRange?: ReportInvoiceDateRange;
};

function parseRangeLabelForInvoice(rangeLabel: string): ReportInvoiceDateRange | null {
  const m = rangeLabel.match(/^(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})$/);
  if (!m) return null;
  return { fromDate: m[1]!, toDate: m[2]! };
}

function fallbackInvoiceRange(): ReportInvoiceDateRange {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const ymd = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return { fromDate: ymd, toDate: ymd };
}

/** Jobs that will produce at least one QuickBooks invoice line (hours, mileage, or travel). */
export function jobsEligibleForQuickBooksInvoice(jobs: ReportExportJob[]): ReportExportJob[] {
  return jobs.filter(
    (j): j is ReportExportJob & { client: NonNullable<ReportExportJob["client"]> } =>
      j.client != null && collectLinesForPayProfile(j, payRatesFromClient(j.client)).length > 0,
  );
}

export function jobsEligibleForQuickBooksBill(jobs: ReportExportJob[]): ReportExportJob[] {
  return jobs.filter(
    (j): j is ReportExportJob & { interpreter: NonNullable<ReportExportJob["interpreter"]> } =>
      j.interpreter != null && collectLinesForPayProfile(j, payRatesFromInterpreter(j.interpreter)).length > 0,
  );
}

/**
 * One invoice per assignment (`*InvoiceNo` = job code `26T-NNNN` when set, else `#id`).
 * A customer may appear on many invoices (one per interpreter submission / job).
 * Additional rows repeat *InvoiceNo only (QuickBooks import pattern).
 * ItemRate / mileage / travel rates come from the client profile.
 */
function quickBooksInvoiceRows(jobs: ReportExportJob[], range: ReportInvoiceDateRange): (string | number)[][] {
  const invoiceDateStr = formatUsDateFromYmd(range.toDate);
  const dueDateStr = formatUsDateFromYmd(addDaysToYmd(range.toDate, 30));

  const withClient = jobs.filter(
    (j): j is ReportExportJob & { client: NonNullable<ReportExportJob["client"]> } => Boolean(j.client),
  );

  const sorted = [...withClient].sort((a, b) => {
    const ta = new Date(a.startTime).getTime();
    const tb = new Date(b.startTime).getTime();
    if (ta !== tb) return ta - tb;
    return formatJobReference(a).localeCompare(formatJobReference(b), undefined, { numeric: true });
  });

  const rows: (string | number)[][] = [QUICKBOOKS_INVOICE_HEADER];

  for (const j of sorted) {
    const client = j.client!;
    const flatLines = collectLinesForJob(j, client);
    if (flatLines.length === 0) continue;

    const invoiceNo = formatJobReference(j);
    const memo = `${invoiceNo} — Assignments ${range.fromDate} through ${range.toDate}`;
    const locationCol = j.location ?? "";

    flatLines.forEach((line, idx) => {
      const amount = roundMoney(line.quantity * line.rate);
      if (idx === 0) {
        rows.push([
          invoiceNo,
          client.name,
          invoiceDateStr,
          dueDateStr,
          "Net 30",
          locationCol,
          memo,
          line.item,
          line.description,
          line.quantity,
          line.rate,
          amount,
          line.serviceDate,
        ]);
      } else {
        rows.push([
          invoiceNo,
          "",
          "",
          "",
          "",
          "",
          "",
          line.item,
          line.description,
          line.quantity,
          line.rate,
          amount,
          line.serviceDate,
        ]);
      }
    });
  }

  return rows;
}

/**
 * One bill per assignment (`*BillNo` = job code). *Supplier* is the interpreter name.
 * Rates come from the interpreter profile (linguist pay).
 */
function quickBooksBillRows(jobs: ReportExportJob[], range: ReportInvoiceDateRange): (string | number)[][] {
  const billDateStr = formatUsDateFromYmd(range.toDate);
  const dueDateStr = formatUsDateFromYmd(addDaysToYmd(range.toDate, 30));

  const withInterpreter = jobs.filter(
    (j): j is ReportExportJob & { interpreter: NonNullable<ReportExportJob["interpreter"]> } =>
      Boolean(j.interpreter),
  );

  const sorted = [...withInterpreter].sort((a, b) => {
    const ta = new Date(a.startTime).getTime();
    const tb = new Date(b.startTime).getTime();
    if (ta !== tb) return ta - tb;
    return formatJobReference(a).localeCompare(formatJobReference(b), undefined, { numeric: true });
  });

  const rows: (string | number)[][] = [QUICKBOOKS_BILL_HEADER];

  for (const j of sorted) {
    const interpreter = j.interpreter!;
    const flatLines = collectLinesForPayProfile(j, payRatesFromInterpreter(interpreter));
    if (flatLines.length === 0) continue;

    const billNo = formatJobReference(j);
    const memo = `${billNo} — Assignments ${range.fromDate} through ${range.toDate}`;
    const locationCol = j.location ?? "";

    flatLines.forEach((line, idx) => {
      const amount = roundMoney(line.quantity * line.rate);
      if (idx === 0) {
        rows.push([
          billNo,
          interpreter.name,
          billDateStr,
          dueDateStr,
          "Net 30",
          locationCol,
          memo,
          line.item,
          line.description,
          line.quantity,
          line.rate,
          amount,
          line.serviceDate,
        ]);
      } else {
        rows.push([
          billNo,
          "",
          "",
          "",
          "",
          "",
          "",
          line.item,
          line.description,
          line.quantity,
          line.rate,
          amount,
          line.serviceDate,
        ]);
      }
    });
  }

  return rows;
}

function customerLeadRows(jobs: ReportExportJob[]): (string | number)[][] {
  const header = [
    "Client",
    "Organization",
    "Email",
    "Phone",
    "Address",
    "Industry",
    "Appointments in range",
    "First appointment",
    "Last appointment",
  ];

  const byClient = new Map<
    number,
    { client: NonNullable<ReportExportJob["client"]>; starts: number[] }
  >();

  for (const j of jobs) {
    if (!j.client) continue;
    const t = new Date(j.startTime).getTime();
    if (Number.isNaN(t)) continue;
    const cur = byClient.get(j.client.id);
    if (!cur) {
      byClient.set(j.client.id, { client: j.client, starts: [t] });
    } else {
      cur.starts.push(t);
    }
  }

  const body = [...byClient.values()]
    .map(({ client, starts }) => {
      starts.sort((a, b) => a - b);
      const first = new Date(starts[0]!);
      const last = new Date(starts[starts.length - 1]!);
      return [
        client.name,
        client.organization ?? "",
        client.email ?? "",
        client.phone ?? "",
        client.address ?? "",
        client.industry ?? "",
        starts.length,
        first.toLocaleDateString(undefined, { dateStyle: "medium" }),
        last.toLocaleDateString(undefined, { dateStyle: "medium" }),
      ];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return [header, ...body];
}

export async function downloadReportExcel(
  kind: ReportKind,
  jobs: ReportExportJob[],
  rangeLabel: string,
  options?: ReportExportExcelOptions,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const range =
    options?.invoiceRange ?? parseRangeLabelForInvoice(rangeLabel) ?? fallbackInvoiceRange();

  let aoa: (string | number)[][];
  if (kind === "customer_lead") {
    aoa = customerLeadRows(jobs);
  } else if (kind === "bill") {
    aoa = quickBooksBillRows(jobs, range);
  } else {
    aoa = quickBooksInvoiceRows(jobs, range);
  }
  const wb = new ExcelJS.Workbook();
  const sheetName =
    kind === "invoice"
      ? "QB invoice import"
      : kind === "bill"
        ? "QB bill import"
        : "Customer leads";
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  for (const row of aoa) {
    ws.addRow(row);
  }

  const slug =
    kind === "invoice" ? "invoice-quickbooks" : kind === "bill" ? "bill-quickbooks" : "customer-leads";
  const safeRange = rangeLabel.replace(/[^\d-]/g, "");
  const filename = `${slug}-report-${safeRange || "export"}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
