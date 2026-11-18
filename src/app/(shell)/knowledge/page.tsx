"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, Field, Modal, PageHeader, Spinner, fmtDateTime } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import BackLink from "@/components/BackLink";
import ConfirmModal from "@/components/ConfirmModal";
import FileUploader from "@/components/FileUploader";
import { DocPreview } from "@/components/case/DocumentsTab";
import { FAULT_DOC_CATEGORIES } from "@/lib/types";
import type { FaultDoc, FaultDocCategory, StoredFile, ToolModel } from "@/lib/types";

type FaultRow = FaultDoc & { file: StoredFile | null; modelNames: string[] };

const CATEGORY_TONES: Record<FaultDocCategory, "red" | "blue" | "green" | "gray"> = {
  fault: "red",
  display: "blue",
  manual: "green",
  other: "gray",
};

function KnowledgeInner() {
  const toast = useToast();
  const [rows, setRows] = useState<FaultRow[] | null>(null);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [modelFilter, setModelFilter] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState<FaultRow | null>(null);
  const [deleting, setDeleting] = useState<FaultRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (modelFilter) params.set("modelId", modelFilter);
      if (category) params.set("category", category);
      if (q) params.set("q", q);
      const data = await apiGet<{ faultDocs: FaultRow[]; filters: { models: { id: string; name: string }[] }; canManage: boolean }>(
        `/api/fault-docs?${params.toString()}`
      );
      setRows(data.faultDocs);
      setModels(data.filters.models);
      setCanManage(data.canManage);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "טעינת מרכז התקלות נכשלה");
    }
  }, [modelFilter, category, q, toast]);

  useEffect(() => { load(); }, [load]);

  async function removeDoc() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/fault-docs/${deleting.id}`, "DELETE");
      toast.push("success", `המסמך "${deleting.title}" נמחק`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "המחיקה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const canFilter = useMemo(() => models.length > 0, [models]);

  if (!rows) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  return (
    <div>
      <BackLink href="/" label="חזרה ללוח הבקרה" />
      <PageHeader
        title="מרכז תקלות ומדריכים"
        subtitle={`${rows.length} מסמכי ידע · קבצי תקלות, הגדרות צג ומדריכים לכל הדגמים — חיפוש מהיר כשיש תקלה בכלי`}
        actions={canManage && <Btn onClick={() => setAddOpen(true)}>+ העלאת מסמך</Btn>}
      />

      {/* סינון */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <select className="field" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
          <option value="">כל הדגמים</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">כל הקטגוריות</option>
          {Object.entries(FAULT_DOC_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="field lg:col-span-2" placeholder="חיפוש — כותרת, קוד תקלה (למשל E-3), תיאור…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="📖"
          title="אין מסמכים להצגה"
          hint={canFilter ? "שנו את הסינון או העלו מסמך חדש — קובץ תקלות, הגדרות צג או מדריך לדגם" : "העלו את המסמך הראשון — קובץ תקלות, הגדרות צג או מדריך לדגם"}
          action={canManage && <Btn onClick={() => setAddOpen(true)}>+ העלאת מסמך</Btn>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((d) => (
            <div key={d.id} className="card flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={CATEGORY_TONES[d.category]}>{FAULT_DOC_CATEGORIES[d.category]}</Badge>
                    {d.code && <span className="num rounded-full bg-cz-ink px-2.5 py-1 text-xs font-bold text-white">{d.code}</span>}
                  </div>
                  <h3 className="mt-2 font-display text-lg font-extrabold leading-snug">{d.title}</h3>
                  {d.notes && <p className="mt-1 line-clamp-2 text-sm text-cz-mut">{d.notes}</p>}
                </div>
              </div>
              <div className="text-xs text-cz-fog">
                דגמים: {d.modelNames.join(" · ") || "—"}
                <br />
                {d.originalName} · {d.uploadedBy} · {fmtDateTime(d.uploadedAt)}
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5 border-t border-cz-line-soft pt-3">
                <Btn size="sm" variant="outline" onClick={() => setPreview(d)}>תצוגה מקדימה</Btn>
                <a href={`/api/files/${d.fileId}?download=1`} className="inline-flex min-h-9 items-center rounded-full px-4 text-sm font-bold text-cz-mut hover:bg-cz-sand">הורדה</a>
                {canManage && (
                  <button onClick={() => setDeleting(d)} className="ms-auto grid size-9 place-items-center rounded-full text-cz-fog hover:bg-cz-red-soft hover:text-cz-red" aria-label={`מחיקת ${d.title}`}>🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* העלאה */}
      {addOpen && <UploadModal models={models} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} />}

      {/* תצוגה מקדימה */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title} wide>
        {preview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone={CATEGORY_TONES[preview.category]}>{FAULT_DOC_CATEGORIES[preview.category]}</Badge>
              {preview.code && <span className="num rounded-full bg-cz-ink px-2.5 py-1 text-xs font-bold text-white">{preview.code}</span>}
              <Badge tone="gray">{preview.modelNames.join(" · ") || "—"}</Badge>
            </div>
            {preview.notes && <p className="rounded-xl bg-cz-bg px-4 py-3 text-sm">{preview.notes}</p>}
            <DocPreview doc={{ ...preview, file: preview.file }} />
          </div>
        )}
      </Modal>

      {/* מחיקה */}
      <ConfirmModal
        open={!!deleting}
        title="מחיקת מסמך"
        message={deleting ? `למחוק את "${deleting.title}"? הקובץ יוסר ממרכז התקלות לצמיתות.` : ""}
        confirmLabel="מחיקה"
        danger
        busy={busy}
        onConfirm={removeDoc}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

// ─── מודל העלאה ─────────────────────────────────────────────────────────────

function UploadModal({ models, onClose, onSaved }: { models: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [pending, setPending] = useState<StoredFile | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FaultDocCategory>("fault");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!pending) { toast.push("error", "העלו קובץ"); return; }
    if (!title.trim()) { toast.push("error", "נדרשת כותרת"); return; }
    if (modelIds.length === 0) { toast.push("error", "בחרו לפחות דגם אחד"); return; }
    setBusy(true);
    try {
      await apiSend("/api/fault-docs", "POST", {
        title: title.trim(), category, code: code.trim() || undefined,
        notes: notes.trim() || undefined, fileId: pending.id, modelIds,
      });
      toast.push("success", "המסמך נוסף למרכז התקלות");
      onSaved();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="העלאת מסמך למרכז התקלות" wide>
      <div className="space-y-4">
        {!pending ? (
          <FileUploader onUploaded={(f) => setPending(f)} onError={(m) => toast.push("error", m)} hint="PDF או תמונה — קובץ תקלות, הגדרות צג או מדריך" />
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-xl bg-cz-bg px-4 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-cz-red-soft text-[11px] font-bold text-cz-red">
                {pending.mime.includes("pdf") ? "PDF" : "IMG"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{pending.originalName}</div>
                <div className="text-xs text-cz-fog">{(pending.size / 1024).toFixed(0)} KB</div>
              </div>
              <Btn size="sm" variant="ghost" onClick={() => setPending(null)}>החלפה</Btn>
            </div>
            <Field label="כותרת">
              <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: הצג מציג E-3 — פתרון" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="קטגוריה">
                <select className="field" value={category} onChange={(e) => setCategory(e.target.value as FaultDocCategory)}>
                  {Object.entries(FAULT_DOC_CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="קוד תקלה" hint="אופציונלי — לחיפוש מהיר">
                <input className="field" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="E-3" />
              </Field>
            </div>
            <Field label="דגמים רלוונטיים">
              <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cz-line bg-white p-3">
                {models.map((m) => {
                  const active = modelIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModelIds((ids) => (active ? ids.filter((x) => x !== m.id) : [...ids, m.id]))}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-cz-red text-white" : "bg-cz-sand text-cz-mut hover:bg-cz-line"}`}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="תיאור / פתרון מקוצר">
              <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="תיאור התקלה והפתרון בשורות" />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose}>ביטול</Btn>
              <Btn onClick={save} loading={busy}>שמירה במרכז התקלות</Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>}>
      <KnowledgeInner />
    </Suspense>
  );
}
