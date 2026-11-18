"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, Field, Modal, PageHeader, Spinner, fmtDateTime } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import BackLink from "@/components/BackLink";
import ConfirmModal from "@/components/ConfirmModal";
import { CALL_STATUS_LABELS, MOVEMENT_LABELS } from "@/lib/types";
import type { FaultDoc, ServiceCall, ServiceCallStatus, StoredFile, ToolModel, Part } from "@/lib/types";

interface CallDetail {
  call: ServiceCall;
  model: ToolModel | null;
  models: ToolModel[];
  linkedParts: Part[];
  attachments: StoredFile[];
  isAgent: boolean;
}

const TONES: Record<ServiceCallStatus, string> = {
  new: "red",
  inProgress: "amber",
  awaitingInfo: "gray",
  awaitingPart: "purple",
  resolved: "green",
  closed: "dark",
};

export default function ServiceCallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [data, setData] = useState<CallDetail | null>(null);
  const [error, setError] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [faultDocs, setFaultDocs] = useState<FaultDoc[]>([]);
  const [faultPreview, setFaultPreview] = useState<FaultDoc | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionText, setResolutionText] = useState("");

  const load = useCallback(async () => {
    try {
      const detail = await apiGet<CallDetail>(`/api/service-calls/${id}`);
      setData(detail);
      // מסמכי תקלות רלוונטיים לדגם הקריאה — לחיפוש מהיר של התקלה
      if (detail.call.modelId) {
        apiGet<{ faultDocs: FaultDoc[] }>(`/api/fault-docs?modelId=${detail.call.modelId}`)
          .then((d) => setFaultDocs(d.faultDocs))
          .catch(() => setFaultDocs([]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינה נכשלה");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <EmptyState icon="⚠️" title="טעינת הקריאה נכשלה" hint={error} />;
  if (!data) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  const { call, model, linkedParts, attachments, isAgent } = data;

  async function patch(payload: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      await apiSend(`/api/service-calls/${call.id}`, "PATCH", payload);
      toast.push("success", message);
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "העדכון נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href="/service" label="חזרה לקריאות שירות" />
      <PageHeader
        title={call.callNumber}
        subtitle={<>{model?.commercialName ?? "—"}{call.frameNumber && <span className="text-cz-mut"> · שלדה {call.frameNumber}</span>}<span className="text-cz-mut"> · נפתחה {fmtDateTime(call.createdAt)} ע"י {call.agentName}</span></>}
        actions={<Badge tone={TONES[call.status] as never}>{CALL_STATUS_LABELS[call.status]}</Badge>}
      />

      <div className="space-y-4">
        {/* תיאור */}
        <section className="card p-5">
          <h3 className="mb-2 font-display font-extrabold">תיאור התקלה</h3>
          <p className="whitespace-pre-wrap text-sm">{call.description}</p>
          {(call.contactName || call.contactPhone) && (
            <div className="mt-3 flex flex-wrap gap-3 border-t border-cz-line-soft pt-3 text-sm">
              {call.contactName && <span>איש קשר: <b>{call.contactName}</b></span>}
              {call.contactPhone && <span dir="ltr" className="font-bold">{call.contactPhone}</span>}
            </div>
          )}
        </section>

        {/* קבצים מצורפים */}
        {attachments.length > 0 && (
          <section className="card p-5">
            <h3 className="mb-3 font-display font-extrabold">תמונות וקבצים</h3>
            <div className="flex flex-wrap gap-2">
              {attachments.map((f) =>
                f.mime.startsWith("image/") ? (
                  <a key={f.id} href={`/api/files/${f.id}`} target="_blank">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${f.id}`} alt={f.originalName} className="size-24 rounded-xl border border-cz-line-soft object-cover" />
                  </a>
                ) : (
                  <a key={f.id} href={`/api/files/${f.id}`} target="_blank" className="rounded-xl border border-cz-line px-4 py-3 text-sm font-bold">צפייה בקובץ</a>
                )
              )}
            </div>
          </section>
        )}

        {/* חלקים מקושרים */}
        {linkedParts.length > 0 && (
          <section className="card p-5">
            <h3 className="mb-3 font-display font-extrabold">חלקים מקושרים</h3>
            <div className="flex flex-wrap gap-2">
              {linkedParts.map((p) => (
                <Link key={p.id} href={`/parts?q=${encodeURIComponent(p.sku)}`} className="rounded-full bg-cz-sand px-4 py-2 text-sm font-bold hover:bg-cz-line">
                  {p.name} · <span className="num">{p.sku}</span> · במלאי <span className="num">{p.qty}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* מרכז תקלות לדגם זה — חיפוש מהיר של התקלה */}
        {faultDocs.length > 0 && (
          <section className="card p-5">
            <h3 className="mb-3 font-display font-extrabold">מרכז תקלות — {model?.commercialName}</h3>
            <div className="space-y-2">
              {faultDocs.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-cz-line-soft px-4 py-3">
                  {d.code && <span className="num rounded-full bg-cz-ink px-2.5 py-1 text-xs font-bold text-white">{d.code}</span>}
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{d.title}</span>
                  <Btn size="sm" variant="outline" onClick={() => setFaultPreview(d)}>צפייה</Btn>
                  <a href={`/api/files/${d.fileId}?download=1`} className="inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold text-cz-mut hover:bg-cz-sand">הורדה</a>
                </div>
              ))}
            </div>
            <Link href={`/knowledge?model=${call.modelId ?? ""}`} className="mt-3 inline-block text-sm font-bold text-cz-red hover:underline">
              כל המסמכים במרכז התקלות →
            </Link>
          </section>
        )}

        {/* טיפול — ליבואן */}
        {!isAgent && (
          <section className="card p-5">
            <h3 className="mb-3 font-display font-extrabold">טיפול היבואן</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="אחראי">
                <input
                  className="field"
                  defaultValue={call.assignee ?? ""}
                  onBlur={(e) => e.target.value !== (call.assignee ?? "") && patch({ assignee: e.target.value }, "האחראי עודכן")}
                  placeholder="שם המטפל"
                />
              </Field>
              <Field label="עדכון סטטוס">
                <select className="field" value={call.status} disabled={busy} onChange={(e) => patch({ status: e.target.value }, "הסטטוס עודכן")}>
                  {Object.entries(CALL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" onClick={() => setNoteOpen(true)}>+ תיעוד טיפול</Btn>
              {call.status !== "resolved" && call.status !== "closed" && (
                <Btn size="sm" variant="green" onClick={() => setResolveOpen(true)}>פתרון וסגירה</Btn>
              )}
              {call.status === "resolved" && (
                <Btn size="sm" variant="dark" onClick={() => patch({ status: "closed" }, "הקריאה נסגרה")}>סגירה סופית</Btn>
              )}
            </div>
            {call.resolution && (
              <div className="mt-3 rounded-xl bg-cz-green-soft px-4 py-3 text-sm font-bold text-cz-green">סיכום פתרון: {call.resolution}</div>
            )}
          </section>
        )}

        {/* יומן טיפול */}
        <section className="card p-5">
          <h3 className="mb-3 font-display font-extrabold">יומן טיפול</h3>
          {call.treatmentLog.length === 0 ? (
            <p className="text-sm text-cz-fog">טרם תועד טיפול</p>
          ) : (
            <ol className="relative space-y-3 border-s-2 border-cz-line ps-4">
              {[...call.treatmentLog].reverse().map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -start-[23px] top-1.5 size-2.5 rounded-full bg-cz-red" />
                  <div className="text-sm font-semibold">{t.note}</div>
                  <div className="text-xs text-cz-fog">{t.user} · {fmtDateTime(t.at)}</div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* היסטוריית סטטוס — תיעוד מלא עם זמנים */}
        <section className="card p-5">
          <h3 className="mb-3 font-display font-extrabold">היסטוריית סטטוס</h3>
          {(call.history ?? []).length === 0 ? (
            <p className="text-sm text-cz-fog">אין שינויי סטטוס מתועדים</p>
          ) : (
            <ol className="relative space-y-3 border-s-2 border-cz-line ps-4">
              {[...(call.history ?? [])].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[23px] top-1.5 size-2.5 rounded-full bg-cz-ink" />
                  <div className="text-sm font-semibold">
                    {h.action}
                    {h.from && <span className="text-cz-mut"> מ"{h.from}"</span>}
                    {h.to && <span className="text-cz-mut"> ל"{h.to}"</span>}
                  </div>
                  <div className="text-xs text-cz-fog">{h.user} · {fmtDateTime(h.at)}</div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* מודל פתרון */}
      <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title="פתרון הקריאה">
        <div className="space-y-4">
          <Field label="סיכום הפתרון">
            <textarea className="field min-h-24" value={resolutionText} onChange={(e) => setResolutionText(e.target.value)} placeholder="מה נעשה? האם הוחלף חלק?" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setResolveOpen(false)}>ביטול</Btn>
            <Btn
              variant="green"
              loading={busy}
              onClick={async () => {
                await patch({ status: "resolved", resolution: resolutionText || "נפתר" }, "הקריאה נפתרה");
                setResolutionText("");
                setResolveOpen(false);
              }}
            >
              סימון כנפתרה
            </Btn>
          </div>
        </div>
      </Modal>

      {/* תצוגת מסמך תקלה */}
      <Modal open={!!faultPreview} onClose={() => setFaultPreview(null)} title={faultPreview?.title} wide>
        {faultPreview && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {faultPreview.code && <span className="num rounded-full bg-cz-ink px-2.5 py-1 text-xs font-bold text-white">{faultPreview.code}</span>}
              {faultPreview.notes && <p className="w-full rounded-xl bg-cz-bg px-4 py-3 text-sm">{faultPreview.notes}</p>}
            </div>
            <iframe src={`/api/files/${faultPreview.fileId}`} className="h-[60vh] w-full rounded-xl border border-cz-line-soft" title={faultPreview.title} />
          </div>
        )}
      </Modal>

      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title="תיעוד טיפול">
        <div className="space-y-4">
          <Field label="מה בוצע">
            <textarea className="field min-h-24" value={note} onChange={(e) => setNote(e.target.value)} placeholder="אבחון, פעולה, חלק שהוחלף…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setNoteOpen(false)}>ביטול</Btn>
            <Btn
              loading={busy}
              onClick={async () => {
                if (!note.trim()) return;
                await patch({ treatmentNote: note, status: call.status === "new" ? "inProgress" : undefined }, "הטיפול תועד");
                setNote("");
                setNoteOpen(false);
              }}
            >
              שמירה
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
