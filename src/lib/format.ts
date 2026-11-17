/** פונקציות עיצוב — משותפות לשרת וללקוח (בלי "use client") */

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtMoney(n?: number) {
  if (n === undefined || n === null) return "—";
  return `${n.toLocaleString("he-IL")} ₪`;
}
