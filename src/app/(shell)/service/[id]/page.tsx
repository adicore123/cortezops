"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, Field, Modal, PageHeader, Spinner, fmtDateTime } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import { CALL_STATUS_LABELS, MOVEMENT_LABELS } from "@/lib/types";
import type { ServiceCall, ServiceCallStatus, ToolModel, Part, StoredFile } from "@/lib/types";

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

  const load = useCallback(async () => {
    try {
      setData(await apiGet<CallDetail>(`/api/service-calls/${id}`));
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
                <Btn size="sm" variant="green" onClick={() => {
                  const resolution = window.prompt("סיכום הפתרון:");
                  if (resolution) patch({ status: "resolved", resolution }, "הקריאה נפתרה");
                }}>פתרון וסגירה</Btn>
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
      </div>

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
