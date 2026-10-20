export const fmtDateTime = (d: Date | null | undefined) =>
  d ? d.toLocaleString("ms-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" }) : "–";

export const fmtMoney = (n: number | null | undefined, currency = "MYR") =>
  n == null ? "–" : new Intl.NumberFormat("ms-MY", { style: "currency", currency }).format(n);

export const fmtNum = (n: number) => new Intl.NumberFormat("ms-MY").format(n);

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  SCHEDULED: "Dijadualkan",
  PUBLISHING: "Sedang post",
  PUBLISHED: "Berjaya",
  PARTIAL: "Sebahagian",
  FAILED: "Gagal",
  PENDING: "Menunggu",
};
