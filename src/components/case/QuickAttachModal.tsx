"use client";

import { useEffect, useState } from "react";
import { apiSend } from "@/lib/client";
import { Btn, Field, Modal } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import FileUploader from "@/components/FileUploader";
import { DOC_TYPE_LABELS } from "@/lib/types";
import type { CaseDocument, Defect, DocumentType, StoredFile } from "@/lib/types";

/** צירוף PDF מהיר לתיק — כפתור בולט בראש כרטיס התיק. ברירת מחדל: תעודת בדיקה. */
export default function QuickAttachModal({
  open,
  caseId,
  defects,
  onClose,
  onSaved,
}: {
  open: boolean;
  caseId: string;
  defects: Defect[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [pending, setPending] = useState<StoredFile | null>(null);
  const [type, setType] = useState<DocumentType>("certificate");
  const [title, setTitle] = useState("");
  const [defectIds, setDefectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPending(null);
      setType("certificate");
      setTitle("");
      setDefectIds([]);
    }
  }, [open]);

  async function save() {
    if (!pending) return;
    setBusy(true);
    try {
      await apiSend<{ document: CaseDocument }>("/api/documents", "POST", {
        caseId,
        fileId: pending.id,
        type,
        title: title || pending.originalName,
        defectIds,
      });
      toast.push("success", "הקובץ צורף לתיק");
      onSaved();
      onClose();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "צירוף הקובץ נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="צירוף PDF לתיק">
      <div className="space-y-4">
        {!pending ? (
          <>
            <FileUploader
              onUploaded={(f) => setPending(f)}
              onError={(m) => toast.push("error", m)}
              hint="תעודה, פרוטוקול בדיקה או מסמך נוסף — PDF או תמונה"
            />
            <p className="text-xs text-cz-fog">
              הקובץ יישמר במסמכי התיק ויופיע גם בתצוגת ההדפסה
            </p>
          </>
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
            <Field label="סוג המסמך">
              <select className="field" value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
                {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="כותרת לתצוגה">
              <input className="field" value={title} placeholder={pending.originalName} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            {defects.length > 0 && (
              <Field label="קישור לליקויים (אופציונלי)">
                <div className="space-y-1.5 rounded-2xl bg-cz-bg p-3">
                  {defects.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        className="size-5 accent-cz-red"
                        checked={defectIds.includes(d.id)}
                        onChange={(e) =>
                          setDefectIds((ids) =>
                            e.target.checked ? [...ids, d.id] : ids.filter((x) => x !== d.id)
                          )
                        }
                      />
                      {d.title}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={onClose}>ביטול</Btn>
              <Btn onClick={save} loading={busy}>צירוף לתיק</Btn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
