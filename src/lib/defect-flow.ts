import type { DefectStatus } from "./types";
import { DEFECT_STATUS_LABELS } from "./types";

/** מעברי סטטוס אפשריים לליקוי — משותף לכרטיס התיק ולעמוד הליקויים המרוכז */
export const DEFECT_FLOW: Record<
  DefectStatus,
  { to: DefectStatus; label: string; variant: "primary" | "green" | "dark" | "outline" }[]
> = {
  open: [{ to: "inProgress", label: "התחלת טיפול", variant: "primary" }],
  inProgress: [{ to: "fixed", label: "סמן כתוקן", variant: "primary" }],
  fixed: [
    { to: "awaitingVerification", label: "העבר לאימות", variant: "dark" },
    { to: "verified", label: "אומת ישירות", variant: "green" },
  ],
  awaitingVerification: [
    { to: "verified", label: "אומת ✓", variant: "green" },
    { to: "inProgress", label: "החזר לטיפול", variant: "outline" },
  ],
  verified: [{ to: "inProgress", label: "פתח מחדש", variant: "outline" }],
};

/** צבעי תג סטטוס ליקוי */
export const DEFECT_STATUS_TONES: Record<DefectStatus, "red" | "amber" | "blue" | "purple" | "green"> = {
  open: "red",
  inProgress: "amber",
  fixed: "blue",
  awaitingVerification: "purple",
  verified: "green",
};

export { DEFECT_STATUS_LABELS };
