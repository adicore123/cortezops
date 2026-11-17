"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/client";
import { Badge, EmptyState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { CASE_STATUS_LABELS } from "@/lib/types";
import type { InspectionCase, CaseStatus } from "@/lib/types";

type CaseRow = InspectionCase & {
  modelName: string;
  openDefects: number;
  awaitingVerification: number;
  missingItems: number;
};

const STATUS_TONES: Record<CaseStatus, "gray" | "blue" | "amber" | "purple" | "green"> = {
  draft: "gray",
  open: "blue",
  inProgress: "amber",
  awaitingInstitute: "purple",
  completed: "green",
};

export default function CasesPage() {
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const load = useCallback(async () => {
    const data = await apiGet<{ cases: CaseRow[] }>("/api/cases");
    setRows(data.cases);
  }, []);

  useEffect(() => { load().catch(() => setRows([])); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((c) => {
      if (status && c.status !== status) return false;
      if (!needle) return true;
      return [c.caseNumber, c.modelName, c.sampleId, c.inspection.certificateNo, c.owner ?? ""]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, status]);

  if (!rows) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  return (
    <div>
      <PageHeader
        title="תיקי מכון התקנים"
        subtitle="מעקב אחר בדיקות, ליקויים ותיקונים לכל דגם ומשלוח"
        actions={
          <Link
            href="/cases/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cz-red px-6 text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(200,10,4,.25)] transition-all hover:bg-cz-red-dark"
          >
            + פתיחת תיק בדיקה
          </Link>
        }
      />

      {/* סינון */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <input className="field pe-10" placeholder="חיפוש לפי מספר תיק, דגם, תעודה…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-cz-fog">🔍</span>
        </div>
        <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.entries(CASE_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📁" title="אין תיקים להצגה" hint="פתחו תיק בדיקה חדש לדגם מהמאגר" />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/cases/${c.id}`} className="card block p-4 transition-shadow hover:shadow-md sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-lg font-bold text-cz-red">{c.caseNumber}</span>
                    <span className="font-display font-extrabold">{c.modelName}</span>
                    {c.sampleId && <span className="text-sm text-cz-mut">מדגם {c.sampleId}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cz-mut">
                    <span>נפתח {fmtDate(c.openedAt)}</span>
                    {c.inspection.certificateNo && <span>· תעודה <span className="num">{c.inspection.certificateNo}</span></span>}
                    {c.owner && <span>· {c.owner}</span>}
                    {c.dueDate && <span className={new Date(c.dueDate) < new Date() ? "font-bold text-cz-red" : ""}>· יעד {fmtDate(c.dueDate)}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.awaitingVerification > 0 && <Badge tone="purple">ממתין לאימות</Badge>}
                  {c.openDefects > 0 && <Badge tone="red">{c.openDefects} ליקויים פתוחים</Badge>}
                  {c.missingItems > 0 && <Badge tone="amber">חסרים {c.missingItems}</Badge>}
                  <Badge tone={STATUS_TONES[c.status]}>{CASE_STATUS_LABELS[c.status]}</Badge>
                </div>
              </div>
              {c.nextAction && (
                <div className="mt-2 rounded-xl bg-cz-sand px-3 py-2 text-xs font-semibold text-cz-ink/80">
                  הפעולה הבאה: {c.nextAction}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
