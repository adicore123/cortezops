"use client";

import { useEffect, useState } from "react";
import { apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, Field, Modal } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import FileUploader, { FileChip } from "@/components/FileUploader";
import { DEFECT_STATUS_LABELS, DOC_TYPE_LABELS } from "@/lib/types";
import { DEFECT_FLOW as FLOW, DEFECT_STATUS_TONES as STATUS_TONES } from "@/lib/defect-flow";
import type { Defect, DefectStatus, StoredFile, CaseDocument } from "@/lib/types";
import type { CaseDetailData } from "@/app/(shell)/cases/[id]/page";

export default function DefectsTab({ data, reload }: { data: CaseDetailData; reload: () => void }) {
  const toast = useToast();
  const { defects, documents } = data;
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Defect | null>(null);
  const [busy, setBusy] = useState(false);

  async function changeStatus(defect: Defect, to: DefectStatus) {
    try {
      await apiSend(`/api/defects/${defect.id}`, "PATCH", { status: to });
      toast.push("success", `${defect.title} → ${DEFECT_STATUS_LABELS[to]}`);
      reload();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Btn onClick={() => setAddOpen(true)}>+ ליקוי חדש</Btn>
      </div>

      {defects.length === 0 ? (
        <EmptyState icon="📝" title="אין ליקויים בתיק" hint="הוסיפו ליקויים כפי שהתקבלו בתעודה ממכון התקנים" action={<Btn onClick={() => setAddOpen(true)}>+ ליקוי חדש</Btn>} />
      ) : (
        defects.map((d) => (
          <div key={d.id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="gray">{d.category}</Badge>
                  <h3 className="font-display text-lg font-extrabold">{d.title}</h3>
                  {d.needsRecheck && <Badge tone="purple">נדרשת בדיקה חוזרת</Badge>}
                </div>
                {d.asReceived && <p className="mt-1.5 text-sm text-cz-mut">{d.asReceived}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cz-fog">
                  {(d.certificateSection || d.certificatePage) && (
                    <span>בתעודה: {d.certificateSection} {d.certificatePage && `· ${d.certificatePage}`}</span>
                  )}
                  {d.owner && <span>אחראי: {d.owner}</span>}
                  {d.dueDate && <span>יעד: {new Date(d.dueDate).toLocaleDateString("he-IL")}</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={STATUS_TONES[d.status]}>{DEFECT_STATUS_LABELS[d.status]}</Badge>
                <div className="flex flex-wrap gap-1.5">
                  {(FLOW[d.status] ?? []).map((op) => (
                    <Btn key={op.to} size="sm" variant={op.variant} onClick={() => changeStatus(d, op.to)}>{op.label}</Btn>
                  ))}
                  <Btn size="sm" variant="outline" onClick={() => setEditing(d)}>פתיחה לעריכה</Btn>
                </div>
              </div>
            </div>

            {/* מדבקה: לפני / אחרי */}
            {d.category === "מדבקה" && (d.fix.beforeFileIds.length > 0 || d.fix.afterFileIds.length > 0) && (
              <div className="mt-4 grid gap-4 border-t border-cz-line-soft pt-4 sm:grid-cols-2">
                <StickerSide title="לפני" text={d.sticker.existingText} fileIds={d.fix.beforeFileIds} documents={documents} />
                <StickerSide title="אחרי" text={d.sticker.updatedText || d.sticker.requiredText} fileIds={d.fix.afterFileIds} documents={documents} ok />
              </div>
            )}

            {/* סטטוס המתנה לאימות */}
            {d.status === "awaitingVerification" && (
              <div className="mt-3 rounded-xl bg-violet-100 px-4 py-2.5 text-sm font-bold text-violet-800">
                התיקון בוצע אצל היבואן — ממתין לאימות{d.needsRecheck ? " (בדיקה חוזרת)" : ""}
              </div>
            )}
            {d.status === "verified" && d.verification.verifiedBy && (
              <div className="mt-3 rounded-xl bg-cz-green-soft px-4 py-2.5 text-sm font-bold text-cz-green">
                אומת ע"י {d.verification.verifiedBy} · {new Date(d.verification.verifiedAt ?? "").toLocaleDateString("he-IL")}
                {d.verification.result && ` — ${d.verification.result}`}
              </div>
            )}
          </div>
        ))
      )}

      <AddDefectModal
        open={addOpen}
        caseId={data.case.id}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); reload(); }}
      />

      {editing && (
        <DefectEditModal
          defect={editing}
          documents={documents}
          busy={busy}
          setBusy={setBusy}
          onClose={() => setEditing(null)}
          reload={reload}
        />
      )}
    </div>
  );
}

function StickerSide({ title, text, fileIds, documents, ok }: { title: string; text?: string; fileIds: string[]; documents: (CaseDocument & { file: StoredFile | null })[]; ok?: boolean }) {
  return (
    <div>
      <div className={`mb-2 text-sm font-extrabold ${ok ? "text-cz-green" : "text-cz-red"}`}>{title}</div>
      {text && (
        <div className={`mb-2 rounded-xl px-3 py-2 text-xs font-semibold ${ok ? "bg-cz-green-soft text-cz-green" : "bg-cz-red-soft text-cz-red"}`} dir="auto">
          {text}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {fileIds.map((fid) => {
          const doc = documents.find((d) => d.fileId === fid);
          const isImage = doc?.file?.mime.startsWith("image/") ?? true;
          return isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={fid} src={`/api/files/${fid}`} alt={`${title} — מדבקה`} className="h-24 rounded-xl border border-cz-line-soft object-cover" />
          ) : (
            <a key={fid} href={`/api/files/${fid}`} target="_blank" className="rounded-xl border border-cz-line px-3 py-2 text-xs font-bold">צפייה בקובץ</a>
          );
        })}
      </div>
    </div>
  );
}

// ─── הוספת ליקוי ────────────────────────────────────────────────────────────

function AddDefectModal({ open, caseId, onClose, onCreated }: { open: boolean; caseId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const empty = {
    category: "מדבקה", title: "", asReceived: "", certificateSection: "", certificatePage: "",
    requiredChange: "", owner: "", dueDate: "", needsRecheck: false,
    sticker: { existingText: "", requiredText: "", location: "" },
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { if (open) { setForm(empty); setErr(""); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setErr("נדרשת כותרת"); return; }
    setBusy(true);
    try {
      await apiSend(`/api/cases/${caseId}/defects`, "POST", { ...form, dueDate: form.dueDate || undefined });
      toast.push("success", "הליקוי נוסף לתיק");
      onCreated();
    } catch (e2) {
      toast.push("error", e2 instanceof Error ? e2.message : "הוספת הליקוי נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="ליקוי חדש" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="קטגוריה">
            <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {["מדבקה", "סימון", "תיוג", "אריזה", "תיעוד", "אחר"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="כותרת" error={err}>
            <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="כיתוב מדבקת יצרן שגוי" />
          </Field>
        </div>
        <Field label="נוסח הליקוי כפי שהתקבל">
          <textarea className="field min-h-16" value={form.asReceived} onChange={(e) => setForm({ ...form, asReceived: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="סעיף בתעודה">
            <input className="field" value={form.certificateSection} onChange={(e) => setForm({ ...form, certificateSection: e.target.value })} placeholder="3.2" />
          </Field>
          <Field label="עמוד בתעודה">
            <input className="field" value={form.certificatePage} onChange={(e) => setForm({ ...form, certificatePage: e.target.value })} placeholder="עמוד 4" />
          </Field>
          <Field label="מועד יעד">
            <input type="date" className="field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>
        <Field label="מה נדרש לשנות">
          <textarea className="field min-h-16" value={form.requiredChange} onChange={(e) => setForm({ ...form, requiredChange: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="אחראי">
            <input className="field" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          </Field>
          <label className="flex items-center gap-3 self-end rounded-xl bg-cz-bg px-4 py-3 text-sm font-bold">
            <input type="checkbox" className="size-5 accent-cz-red" checked={form.needsRecheck} onChange={(e) => setForm({ ...form, needsRecheck: e.target.checked })} />
            נדרשת בדיקה חוזרת
          </label>
        </div>

        {form.category === "מדבקה" && (
          <div className="grid gap-4 rounded-2xl bg-cz-sand/60 p-4 sm:grid-cols-2">
            <Field label="הכיתוב הקיים">
              <input className="field" value={form.sticker.existingText} onChange={(e) => setForm({ ...form, sticker: { ...form.sticker, existingText: e.target.value } })} />
            </Field>
            <Field label="הכיתוב הנדרש">
              <input className="field" value={form.sticker.requiredText} onChange={(e) => setForm({ ...form, sticker: { ...form.sticker, requiredText: e.target.value } })} />
            </Field>
            <Field label="מיקום המדבקה">
              <input className="field" value={form.sticker.location} onChange={(e) => setForm({ ...form, sticker: { ...form.sticker, location: e.target.value } })} />
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Btn variant="ghost" type="button" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" loading={busy}>הוספת הליקוי</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── עריכת ליקוי: תיקון, מדבקה, אימות ──────────────────────────────────────

function DefectEditModal({
  defect, documents, busy, setBusy, onClose, reload,
}: {
  defect: Defect;
  documents: (CaseDocument & { file: StoredFile | null })[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  reload: () => void;
}) {
  const toast = useToast();
  const [fix, setFix] = useState({ date: "", performer: "", description: "" });
  const [sticker, setSticker] = useState({ existingText: "", requiredText: "", updatedText: "", location: "" });
  const [verif, setVerif] = useState({ method: "", result: "" });

  useEffect(() => {
    setFix({
      date: defect.fix.date?.slice(0, 10) ?? "",
      performer: defect.fix.performer ?? "",
      description: defect.fix.description ?? "",
    });
    setSticker({
      existingText: defect.sticker.existingText ?? "",
      requiredText: defect.sticker.requiredText ?? "",
      updatedText: defect.sticker.updatedText ?? "",
      location: defect.sticker.location ?? "",
    });
    setVerif({ method: defect.verification.method ?? "", result: defect.verification.result ?? "" });
  }, [defect]);

  async function save() {
    setBusy(true);
    try {
      await apiSend(`/api/defects/${defect.id}`, "PATCH", {
        fix: { date: fix.date || undefined, performer: fix.performer, description: fix.description },
        sticker,
        verification: { method: verif.method, result: verif.result },
      });
      toast.push("success", "הליקוי עודכן");
      onClose();
      reload();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function attachImage(kind: "beforeAdd" | "afterAdd", file: StoredFile) {
    await apiSend(`/api/defects/${defect.id}`, "PATCH", { fix: { [kind]: file } });
    // ראיית תיקון — מסמך מקושר לתיק ולליקוי
    await apiSend("/api/documents", "POST", {
      caseId: defect.caseId, fileId: file.id, type: "fixProof",
      defectIds: [defect.id], title: `${kind === "beforeAdd" ? "לפני" : "אחרי"} — ${defect.title}`,
    });
    toast.push("success", "התמונה צורפה");
    reload();
  }

  return (
    <Modal open onClose={onClose} title={`ליקוי — ${defect.title}`} wide>
      <div className="space-y-5">
        {/* תיעוד תיקון */}
        <section className="rounded-2xl border border-cz-line-soft p-4">
          <h4 className="mb-3 font-display font-extrabold">תיעוד התיקון</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="תאריך ביצוע">
              <input type="date" className="field" value={fix.date} onChange={(e) => setFix({ ...fix, date: e.target.value })} />
            </Field>
            <Field label="מבצע התיקון">
              <input className="field" value={fix.performer} onChange={(e) => setFix({ ...fix, performer: e.target.value })} />
            </Field>
          </div>
          <Field label="תיאור מה בוצע">
            <textarea className="field mt-3 min-h-16" value={fix.description} onChange={(e) => setFix({ ...fix, description: e.target.value })} />
          </Field>
        </section>

        {/* מדבקה */}
        {defect.category === "מדבקה" && (
          <section className="rounded-2xl border border-cz-line-soft p-4">
            <h4 className="mb-3 font-display font-extrabold">פרטי מדבקה</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="הכיתוב הקיים">
                <input className="field" value={sticker.existingText} onChange={(e) => setSticker({ ...sticker, existingText: e.target.value })} />
              </Field>
              <Field label="הכיתוב שנדרש להחליף">
                <input className="field" value={sticker.requiredText} onChange={(e) => setSticker({ ...sticker, requiredText: e.target.value })} />
              </Field>
              <Field label="הנוסח המעודכן">
                <input className="field" value={sticker.updatedText} onChange={(e) => setSticker({ ...sticker, updatedText: e.target.value })} />
              </Field>
              <Field label="מיקום המדבקה">
                <input className="field" value={sticker.location} onChange={(e) => setSticker({ ...sticker, location: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="label">תמונה לפני</div>
                <FileUploader compact capture onUploaded={(f) => attachImage("beforeAdd", f)} onError={(m) => toast.push("error", m)} hint="צילום המדבקה לפני ההחלפה" />
                {defect.fix.beforeFileIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {defect.fix.beforeFileIds.map((fid) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={fid} src={`/api/files/${fid}`} alt="לפני" className="h-20 rounded-xl border border-cz-line object-cover" />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="label">תמונה אחרי</div>
                <FileUploader compact capture onUploaded={(f) => attachImage("afterAdd", f)} onError={(m) => toast.push("error", m)} hint="צילום המדבקה החדשה" />
                {defect.fix.afterFileIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {defect.fix.afterFileIds.map((fid) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={fid} src={`/api/files/${fid}`} alt="אחרי" className="h-20 rounded-xl border border-cz-line object-cover" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* אימות ובדיקה חוזרת */}
        <section className="rounded-2xl border border-cz-line-soft p-4">
          <h4 className="mb-3 font-display font-extrabold">אימות / בדיקה חוזרת</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="אופן האימות">
              <input className="field" value={verif.method} onChange={(e) => setVerif({ ...verif, method: e.target.value })} placeholder="בדיקה חוזרת במכון" />
            </Field>
            <Field label="תוצאה">
              <input className="field" value={verif.result} onChange={(e) => setVerif({ ...verif, result: e.target.value })} placeholder="עבר / טרם התקבל" />
            </Field>
          </div>
          {defect.needsRecheck && (
            <p className="mt-2 text-xs text-cz-fog">
              דוחות חוזרים שהועלו לתיק: {documents.filter((d) => d.type === "reinspection").length} ·{" "}
              {documents.filter((d) => d.type === "reinspection").map((d) => d.title).join(", ") || "טרם הועלו"}
            </p>
          )}
        </section>

        {/* היסטוריית סטטוסים */}
        <section className="rounded-2xl bg-cz-bg p-4">
          <h4 className="mb-2 font-display font-extrabold">היסטוריית סטטוסים</h4>
          <ol className="space-y-1.5 text-sm">
            {[...defect.history].reverse().map((h, i) => (
              <li key={i} className="flex flex-wrap gap-2 text-cz-mut">
                <span className="font-bold text-cz-ink">{h.action}{h.to ? ` → ${h.to}` : ""}</span>
                <span className="text-xs">{h.user} · {new Date(h.at).toLocaleString("he-IL")}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>סגירה</Btn>
          <Btn onClick={save} loading={busy}>שמירת הליקוי</Btn>
        </div>
      </div>
    </Modal>
  );
}
