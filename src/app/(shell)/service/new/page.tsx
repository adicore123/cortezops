"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { Btn, Field, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import FileUploader, { FileChip } from "@/components/FileUploader";
import type { ToolModel, Part, StoredFile } from "@/lib/types";

/** טופס פתיחת קריאה — מותאם נייד בראש ובראשונה (סוכנים בשטח). */
export default function NewServiceCallPage() {
  const router = useRouter();
  const toast = useToast();
  const [models, setModels] = useState<ToolModel[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [modelId, setModelId] = useState("");
  const [frameNumber, setFrameNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<StoredFile[]>([]);
  const [linkedPartIds, setLinkedPartIds] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ models: ToolModel[] }>("/api/models").then((d) => setModels(d.models.filter((m) => !m.archived))).catch(() => {});
    apiGet<{ parts: Part[] }>("/api/parts").then((d) => setParts(d.parts)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!modelId) { setErr("בחרו דגם כלי"); return; }
    if (!description.trim()) { setErr("נדרש תיאור התקלה"); return; }
    setBusy(true);
    try {
      const res = await apiSend<{ call: ServiceCallLike }>("/api/service-calls", "POST", {
        modelId,
        frameNumber,
        contactName,
        contactPhone,
        description,
        attachmentFileIds: attachments.map((a) => a.id),
        linkedPartIds,
      });
      toast.push("success", `הקריאה ${res.call.callNumber} נפתחה ודווחה ליבואן`);
      router.push(`/service/${res.call.id}`);
    } catch (e2) {
      toast.push("error", e2 instanceof Error ? e2.message : "פתיחת הקריאה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const relevantParts = modelId ? parts.filter((p) => p.compatibleModelIds.includes(modelId)) : parts;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="קריאת שירות חדשה" subtitle="הפרטים נשלחים מיד ליבואן — אפשר לצלם את התקלה מהמצלמה" />

      <form onSubmit={submit} className="card space-y-5 p-5">
        <Field label="דגם הכלי" error={err && !modelId ? err : undefined}>
          <select className="field text-base" value={modelId} onChange={(e) => setModelId(e.target.value)}>
            <option value="">— בחרו דגם —</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.commercialName}</option>)}
          </select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מספר שלדה" hint="אם קיים">
            <input className="field" dir="ltr" inputMode="numeric" value={frameNumber} onChange={(e) => setFrameNumber(e.target.value)} />
          </Field>
          <Field label="טלפון לחזרה">
            <input className="field" dir="ltr" type="tel" inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </Field>
        </div>

        <Field label="איש קשר">
          <input className="field" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="שם הלקוח / החנות" />
        </Field>

        <Field label="תיאור התקלה" error={err && !description.trim() ? err : undefined}>
          <textarea className="field min-h-28 text-base" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="מה התקלה? מתי מופיעה? מה כבר נוסה?" />
        </Field>

        <Field label="תמונות וקבצים">
          <FileUploader onUploaded={(f) => setAttachments((a) => [...a, f])} onError={(m) => toast.push("error", m)} hint="צילום מהמצלמה או PDF" accept="image/*,application/pdf" />
          {attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((f) => <FileChip key={f.id} file={f} onRemove={() => setAttachments((a) => a.filter((x) => x.id !== f.id))} />)}
            </div>
          )}
        </Field>

        {relevantParts.length > 0 && (
          <Field label="חלק רלוונטי חשוד" hint="לא חובה — יקושר לקריאה">
            <select
              className="field"
              value=""
              onChange={(e) => { if (e.target.value && !linkedPartIds.includes(e.target.value)) setLinkedPartIds((ids) => [...ids, e.target.value]); }}
            >
              <option value="">— הוספת חלק —</option>
              {relevantParts.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
            {linkedPartIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {linkedPartIds.map((pid) => {
                  const p = parts.find((x) => x.id === pid);
                  return (
                    <span key={pid} className="flex items-center gap-1.5 rounded-full bg-cz-sand px-3 py-1.5 text-xs font-bold">
                      {p?.name ?? pid}
                      <button type="button" onClick={() => setLinkedPartIds((ids) => ids.filter((x) => x !== pid))} aria-label="הסרה">✕</button>
                    </span>
                  );
                })}
              </div>
            )}
          </Field>
        )}

        <div className="sticky bottom-4 pt-2">
          <Btn type="submit" size="lg" loading={busy} className="w-full">שליחת הקריאה ליבואן</Btn>
        </div>
      </form>
    </div>
  );
}

interface ServiceCallLike { id: string; callNumber: string }
