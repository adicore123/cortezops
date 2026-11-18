"use client";

import { useState } from "react";
import { apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, Field, Modal, fmtDateTime } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import FileUploader from "@/components/FileUploader";
import ConfirmModal from "@/components/ConfirmModal";
import { DOC_TYPE_LABELS } from "@/lib/types";
import type { CaseDocument, DocumentType, StoredFile, Defect } from "@/lib/types";
import type { CaseDetailData } from "@/app/(shell)/cases/[id]/page";

const TYPE_TONES: Record<DocumentType, "red" | "purple" | "gray" | "blue" | "green"> = {
  certificate: "red",
  reinspection: "purple",
  shipping: "gray",
  correspondence: "blue",
  fixProof: "green",
};

export default function DocumentsTab({ data, reload }: { data: CaseDetailData; reload: () => void }) {
  const toast = useToast();
  const { case: kase, documents, defects } = data;
  const [pending, setPending] = useState<StoredFile | null>(null);
  const [preview, setPreview] = useState<(CaseDocument & { file: StoredFile | null }) | null>(null);
  const [removing, setRemoving] = useState<(CaseDocument & { file: StoredFile | null }) | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ type: DocumentType; title: string; note: string; defectIds: string[]; supersedesId: string }>({
    type: "certificate", title: "", note: "", defectIds: [], supersedesId: "",
  });

  function toggleSel(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function saveDoc() {
    if (!pending) return;
    try {
      await apiSend("/api/documents", "POST", {
        caseId: kase.id,
        fileId: pending.id,
        type: form.type,
        title: form.title || pending.originalName,
        note: form.note,
        defectIds: form.defectIds,
        supersedesId: form.supersedesId || undefined,
      });
      toast.push("success", "המסמך נשמר בתיק");
      setPending(null);
      setForm({ type: "certificate", title: "", note: "", defectIds: [], supersedesId: "" });
      reload();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "שמירת המסמך נכשלה");
    }
  }

  async function removeDoc(id: string) {
    try {
      await apiSend(`/api/documents?id=${id}`, "DELETE");
      toast.push("success", "המסמך הוסר");
      setRemoving(null);
      reload();
    } catch {
      toast.push("error", "ההסרה נכשלה");
    }
  }

  return (
    <div className="space-y-4">
      {/* העלאה */}
      <div className="card p-5">
        <h3 className="mb-3 font-display font-extrabold">העלאת מסמך שהתקבל</h3>
        <FileUploader
          onUploaded={(f) => setPending(f)}
          onError={(m) => toast.push("error", m)}
          hint="תעודות PDF, דוחות חוזרים, תכתובות ותמונות — כפי שהתקבלו במייל"
        />
      </div>

      {/* פעולות הדפסה */}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/print/case/${kase.id}`}
          target="_blank"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-cz-line bg-white px-5 text-[15px] font-bold hover:border-cz-red hover:text-cz-red"
        >
          🖨️ סיכום תיק להדפסה
        </a>
        {selected.size > 0 && (
          <a
            href={`/print/documents?ids=${Array.from(selected).join(",")}`}
            target="_blank"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cz-ink px-5 text-[15px] font-bold text-white"
          >
            🖨️ הדפסת <span className="num">{selected.size}</span> מסמכים שנבחרו
          </a>
        )}
      </div>

      {/* רשימת מסמכים */}
      {documents.length === 0 ? (
        <EmptyState icon="📄" title="אין מסמכים בתיק" hint="העלו את תעודת הבדיקה ומסמכים נוספים שהתקבלו" />
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className={`card flex flex-wrap items-center gap-3 p-4 ${doc.supersededBy ? "opacity-55" : ""}`}>
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-cz-red"
                checked={selected.has(doc.id)}
                onChange={() => toggleSel(doc.id)}
                aria-label={`בחירת ${doc.title}`}
              />
              {doc.file?.mime.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${doc.fileId}`} alt={doc.title} className="size-14 rounded-xl border border-cz-line-soft object-cover" />
              ) : (
                <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-cz-red-soft text-[11px] font-bold text-cz-red">PDF</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{doc.title}</span>
                  <Badge tone={TYPE_TONES[doc.type]}>{DOC_TYPE_LABELS[doc.type]}</Badge>
                  {doc.supersededBy && <Badge tone="gray">דוח קודם — הוחלף</Badge>}
                </div>
                <div className="mt-0.5 text-xs text-cz-fog">
                  {doc.uploadedBy} · {fmtDateTime(doc.uploadedAt)}
                  {doc.defectIds.length > 0 && ` · מקושר ל־${doc.defectIds.length} ליקויים`}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Btn size="sm" variant="outline" onClick={() => setPreview(doc)}>תצוגה מקדימה</Btn>
                <a href={`/api/files/${doc.fileId}?download=1`} className="inline-flex min-h-9 items-center rounded-full px-4 text-sm font-bold text-cz-mut hover:bg-cz-sand">הורדה</a>
                <button onClick={() => setRemoving(doc)} className="grid size-9 place-items-center rounded-full text-cz-fog hover:bg-cz-red-soft hover:text-cz-red" aria-label="הסרה">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* סיווג קובץ שהועלה */}
      <Modal open={!!pending} onClose={() => setPending(null)} title="סיווג המסמך">
        {pending && (
          <div className="space-y-4">
            <div className="rounded-xl bg-cz-bg px-4 py-3 text-sm font-bold">{pending.originalName}</div>
            <Field label="סוג המסמך">
              <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DocumentType })}>
                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="כותרת לתצוגה">
              <input className="field" value={form.title} placeholder={pending.originalName} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            {defects.length > 0 && (
              <Field label="קישור לליקויים הרלוונטיים">
                <div className="space-y-1.5">
                  {defects.map((d: Defect) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="size-5 accent-cz-red"
                        checked={form.defectIds.includes(d.id)}
                        onChange={(e) =>
                          setForm({ ...form, defectIds: e.target.checked ? [...form.defectIds, d.id] : form.defectIds.filter((x) => x !== d.id) })
                        }
                      />
                      {d.title}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {form.type === "reinspection" && documents.some((d) => d.type === "reinspection" && !d.supersededBy) && (
              <Field label="דוח חוזר זה מחליף דוח קודם?">
                <select className="field" value={form.supersedesId} onChange={(e) => setForm({ ...form, supersedesId: e.target.value })}>
                  <option value="">לא מחליף</option>
                  {documents.filter((d) => d.type === "reinspection" && !d.supersededBy).map((d) => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="הערה">
              <input className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setPending(null)}>ביטול</Btn>
              <Btn onClick={saveDoc}>שמירה בתיק</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* תצוגה מקדימה */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title} wide>
        {preview && <DocPreview doc={preview} />}
      </Modal>

      <ConfirmModal
        open={!!removing}
        title="הסרת מסמך"
        message={removing ? `להסיר את "${removing.title}" מהתיק? הקובץ עצמו יישמר באחסון אך יוסר מרשימת המסמכים.` : ""}
        confirmLabel="הסרה"
        danger
        onConfirm={() => removing && removeDoc(removing.id)}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}

export function DocPreview({ doc }: { doc: { title?: string; fileId: string; file: StoredFile | null } }) {
  const mime = doc.file?.mime ?? "";
  if (mime.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/files/${doc.fileId}`} alt={doc.title} className="mx-auto max-h-[70vh] rounded-xl" />;
  }
  return (
    <iframe
      src={`/api/files/${doc.fileId}`}
      className="h-[70vh] w-full rounded-xl border border-cz-line-soft"
      title={doc.title}
    />
  );
}
