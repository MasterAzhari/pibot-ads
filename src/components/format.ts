export const fmtDateTime = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" }) : "–";

export const fmtMoney = (n: number | null | undefined, currency = "MYR") =>
  n == null ? "–" : new Intl.NumberFormat("en-MY", { style: "currency", currency }).format(n);

export const fmtNum = (n: number) => new Intl.NumberFormat("en-MY").format(n);

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  PARTIAL: "Partial",
  FAILED: "Failed",
  PENDING: "Pending",
};
