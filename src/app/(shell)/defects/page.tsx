"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, PageHeader, ListSkeleton, fmtDate, fmtDateTime } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import ConfirmModal from "@/components/ConfirmModal";
import { DEFECT_FLOW, DEFECT_STATUS_LABELS, DEFECT_STATUS_TONES } from "@/lib/defect-flow";
import type { DefectStatus } from "@/lib/types";

interface DefectRow {
  id: string;
  caseId: string;
  caseNumber: string;
  caseStatus: string;
  modelId: string;
  modelName: string;
  category: string;
  title: string;
  owner: string;
  dueDate?: string;
  status: DefectStatus;
  needsRecheck: boolean;
  certificateSection: string;
  updatedAt: string;
  createdAt: string;
}

interface Filters {
  categories: string[];
  owners: string[];
  models: { id: string; name: string }[];
}

function DefectsInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<DefectRow[] | null>(null);
  const [filterDefs, setFilterDefs] = useState<Filters>({ categories: [], owners: [], models: [] });
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [category, setCategory] = useState("");
  const [owner, setOwner] = useState("");
  const [modelId, setModelId] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DefectRow | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (category) params.set("category", category);
      if (owner) params.set("owner", owner);
      if (modelId) params.set("modelId", modelId);
      if (q) params.set("q", q);
      const data = await apiGet<{ defects: DefectRow[]; filters: Filters }>(
        `/api/defects?${params.toString()}`
      );
      setRows(data.defects);
      setFilterDefs(data.filters);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "טעינת הליקויים נכשלה");
    }
  }, [status, category, owner, modelId, q, toast]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Partial<Record<DefectStatus, number>> = {};
    for (const s of Object.keys(DEFECT_STATUS_LABELS) as DefectStatus[]) {
      c[s] = (rows ?? []).filter((r) => r.status === s).length;
    }
    return c;
  }, [rows]);

  async function changeStatus(row: DefectRow, to: DefectStatus) {
    setBusyId(row.id);
    setOpenMenuId(null);
    try {
      await apiSend(`/api/defects/${row.id}`, "PATCH", { status: to });
      toast.push("success", `${row.title} → ${DEFECT_STATUS_LABELS[to]}`);
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "העדכון נכשל");
    } finally {
      setBusyId(null);
    }
  }

  async function removeDefect() {
    if (!deleting) return;
    try {
      await apiSend(`/api/defects/${deleting.id}`, "DELETE");
      toast.push("success", `הליקוי "${deleting.title}" נמחק ונרשם בהיסטוריית התיק`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "המחיקה נכשלה");
    }
  }

  if (!rows) return <ListSkeleton rows={5} />;

  return (
    <div>
      <PageHeader
        title="ליקויים — כל הכלים"
        subtitle={`${rows.length} ליקויים · ניהול מרוכז לכל הליקויים של כל תיקי מכון התקנים`}
      />

      {/* סינון */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.entries(DEFECT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">כל הקטגוריות</option>
          {filterDefs.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="field" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">כל האחראים</option>
          {filterDefs.owners.map((o) => <option key={o}>{o}</option>)}
        </select>
        <select className="field" value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">כל הדגמים</option>
          {filterDefs.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input className="field" placeholder="חיפוש חופשי…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* מונים לפי סטטוס — ציפים ללחיצה */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatus("")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${status === "" ? "bg-cz-ink text-white" : "bg-white border border-cz-line text-cz-mut hover:border-cz-red"}`}
        >
          הכול ({rows.length})
        </button>
        {(Object.keys(DEFECT_STATUS_LABELS) as DefectStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${status === s ? "bg-cz-ink text-white" : "bg-white border border-cz-line text-cz-mut hover:border-cz-red"}`}
          >
            {DEFECT_STATUS_LABELS[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="📝" title="אין ליקויים להצגה" hint="שנו את הסינון, או פתחו ליקוי מתוך תיק מכון התקנים" />
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.id} className="card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-48 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gray">{r.category}</Badge>
                  <span className="font-display font-extrabold">{r.title}</span>
                  {r.needsRecheck && r.status !== "verified" && <Badge tone="purple">בדיקה חוזרת</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-cz-mut">
                  <Link href={`/cases/${r.caseId}?tab=defects`} className="num font-bold text-cz-red hover:underline">
                    {r.caseNumber}
                  </Link>
                  <span>{r.modelName}</span>
                  {r.owner && <span>אחראי: {r.owner}</span>}
                  {r.dueDate && <span>יעד: {fmtDate(r.dueDate)}</span>}
                  {r.certificateSection && <span>בתעודה: {r.certificateSection}</span>}
                  <span className="text-cz-fog">עודכן: {fmtDateTime(r.updatedAt)}</span>
                </div>
              </div>
              <Badge tone={DEFECT_STATUS_TONES[r.status]}>{DEFECT_STATUS_LABELS[r.status]}</Badge>
              <div className="relative flex items-center gap-1.5">
                <Btn
                  size="sm"
                  variant="outline"
                  loading={busyId === r.id}
                  onClick={() => setOpenMenuId((v) => (v === r.id ? null : r.id))}
                >
                  עדכון סטטוס
                </Btn>
                {openMenuId === r.id && (
                  <div className="absolute bottom-11 end-0 z-20 w-48 overflow-hidden rounded-2xl border border-cz-line bg-white shadow-xl">
                    {DEFECT_FLOW[r.status].map((op) => (
                      <button
                        key={op.to}
                        onClick={() => changeStatus(r, op.to)}
                        className="block w-full px-4 py-2.5 text-start text-sm font-bold hover:bg-cz-bg"
                      >
                        → {DEFECT_STATUS_LABELS[op.to]}
                      </button>
                    ))}
                  </div>
                )}
                <Link href={`/cases/${r.caseId}?tab=defects`} className="inline-flex min-h-9 items-center rounded-full bg-cz-sand px-4 text-xs font-bold text-cz-ink hover:bg-cz-line">
                  לתיק
                </Link>
                <button
                  onClick={() => setDeleting(r)}
                  className="grid size-9 place-items-center rounded-full text-cz-fog hover:bg-cz-red-soft hover:text-cz-red"
                  aria-label={`מחיקת ${r.title}`}
                  title="מחיקת הליקוי"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleting}
        title="מחיקת ליקוי"
        message={deleting ? `למחוק את הליקוי "${deleting.title}" מהתיק ${deleting.caseNumber}? הרשומה תימחק לצמיתות והמחיקה תירשם בהיסטוריית התיק.` : ""}
        confirmLabel="מחיקה"
        danger
        onConfirm={removeDefect}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

export default function DefectsPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} />}>
      <DefectsInner />
    </Suspense>
  );
}
