"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet, apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, Field, Modal, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import { APPROVAL_LABELS } from "@/lib/types";
import type { ToolModel, ApprovalStatus } from "@/lib/types";

type ModelRow = ToolModel & { caseCount: number; partCount: number };

const APPROVAL_TONES: Record<ApprovalStatus, "green" | "amber" | "red"> = {
  approved: "green",
  pending: "amber",
  returned: "red",
};

interface Me {
  user: { role: string; permissions: { cases: boolean } };
}

export default function ModelsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<ModelRow[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ToolModel | null>(null);
  const [busy, setBusy] = useState(false);
  const [returnModel, setReturnModel] = useState<ModelRow | null>(null);
  const [returnNote, setReturnNote] = useState("");

  const load = useCallback(async () => {
    try {
      const [data, meData] = await Promise.all([
        apiGet<{ models: ModelRow[] }>("/api/models"),
        apiGet<Me>("/api/auth/me"),
      ]);
      setRows(data.models);
      setMe(meData);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "טעינה נכשלה");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const canEdit = me?.user.role === "admin" || me?.user.role === "staff";
  const canApprove = me?.user.role === "admin" || (me?.user.role === "staff" && me.user.permissions.cases);

  const categories = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.category).filter(Boolean))),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((m) => {
      if (!showArchived && m.archived) return false;
      if (showArchived && !m.archived) return false;
      if (category && m.category !== category) return false;
      if (!needle) return true;
      return [m.commercialName, m.manufacturerCode, m.manufacturer, m.country]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, category, showArchived]);

  async function setApproval(m: ModelRow, status: ApprovalStatus, note = "") {
    try {
      await apiSend(`/api/models/${m.id}`, "PATCH", { approvalStatus: status, approvalNote: note });
      toast.push("success", `הדגם סומן כ${APPROVAL_LABELS[status]}`);
      load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  async function toggleArchive(m: ModelRow) {
    try {
      await apiSend(`/api/models/${m.id}`, "PATCH", { archived: !m.archived });
      toast.push("success", m.archived ? "הדגם הוחזר מהארכיון" : "הדגם הועבר לארכיון (הקישורים נשמרו)");
      load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "העדכון נכשל");
    }
  }

  if (!rows) {
    return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="מאגר דגמים"
        subtitle={`${rows.filter((r) => !r.archived).length} דגמים פעילים · אישור פנימי, תיקים וחלפים בכרטיס אחד`}
        actions={canEdit && (
          <Btn onClick={() => { setEditing(null); setEditOpen(true); }}>+ דגם חדש</Btn>
        )}
      />

      {/* סינון */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <input
            className="field pe-10"
            placeholder="חיפוש לפי שם, קוד דגם, יצרן…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-cz-fog">🔍</span>
        </div>
        <select className="field w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Btn variant={showArchived ? "dark" : "outline"} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "ארכיון" : "פעילים"}
        </Btn>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🚲"
          title={showArchived ? "אין דגמים בארכיון" : "אין דגמים להצגה"}
          hint="נסו לשנות את הסינון או הוסיפו דגם חדש"
          action={canEdit && !showArchived && <Btn onClick={() => { setEditing(null); setEditOpen(true); }}>+ דגם חדש</Btn>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="card flex flex-col overflow-hidden p-0">
              {/* תמונת הכלי */}
              <Link href={`/models/${m.id}`} className="relative block aspect-[16/9] bg-cz-sand" aria-label={m.commercialName}>
                {m.imageFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${m.imageFileId}`} alt={m.commercialName} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="size-12 text-cz-line" aria-hidden>
                      <path d="M15 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 17c0-3 3-4.5 6-4.5s6 1.5 6 4.5v2H4zM17.5 8l3.5 6h-7z" />
                    </svg>
                  </span>
                )}
                {m.archived && (
                  <span className="absolute end-3 top-3"><Badge tone="gray">בארכיון</Badge></span>
                )}
              </Link>

              <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/models/${m.id}`} className="font-display text-lg font-extrabold leading-snug hover:text-cz-red">
                    {m.commercialName}
                  </Link>
                  <div className="mt-0.5 text-sm text-cz-mut">
                    {[m.manufacturer, m.manufacturerCode && `קוד ${m.manufacturerCode}`, m.country].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {!m.archived && m.approval.status === "pending" && canApprove && (
                  <Badge tone="amber">דורש אישור</Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={APPROVAL_TONES[m.approval.status]}>{APPROVAL_LABELS[m.approval.status]}</Badge>
                {m.category && <Badge tone="gray">{m.category}</Badge>}
              </div>

              {m.approval.status === "returned" && m.approval.note && (
                <div className="rounded-xl bg-cz-red-soft px-3 py-2 text-xs font-semibold text-cz-red">{m.approval.note}</div>
              )}
              {m.approval.status === "approved" && m.approval.approver && (
                <div className="text-xs text-cz-fog">אושר ע"י {m.approval.approver} · {fmtDate(m.approval.date)}</div>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-cz-line-soft pt-3 text-sm">
                <Link href={`/models/${m.id}`} className="font-bold text-cz-ink hover:text-cz-red">
                  תיקים <span className="num">{m.caseCount}</span>
                </Link>
                <span className="text-cz-fog">·</span>
                <span className="text-cz-mut">חלפים <span className="num">{m.partCount}</span></span>
                <span className="ms-auto flex gap-1">
                  {canApprove && !m.archived && m.approval.status !== "approved" && (
                    <button onClick={() => setApproval(m, "approved")} className="rounded-full px-3 py-1.5 text-xs font-bold text-cz-green hover:bg-cz-green-soft">אישור</button>
                  )}
                  {canApprove && !m.archived && m.approval.status !== "returned" && (
                    <button onClick={() => { setReturnModel(m); setReturnNote(""); }} className="rounded-full px-3 py-1.5 text-xs font-bold text-cz-red hover:bg-cz-red-soft">החזרה</button>
                  )}
                  {canEdit && (
                    <>
                      <button onClick={() => { setEditing(m); setEditOpen(true); }} className="rounded-full px-3 py-1.5 text-xs font-bold text-cz-mut hover:bg-cz-sand">עריכה</button>
                      <button onClick={() => toggleArchive(m)} className="rounded-full px-3 py-1.5 text-xs font-bold text-cz-mut hover:bg-cz-sand">
                        {m.archived ? "החזרה" : "ארכוב"}
                      </button>
                    </>
                  )}
                </span>
              </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* דיאלוג החזרת דגם להשלמות */}
      <Modal open={returnModel !== null} onClose={() => setReturnModel(null)} title={returnModel ? `החזרת דגם — ${returnModel.commercialName}` : ""}>
        <div className="space-y-4">
          <Field label="הערת החזרה (מה חסר?)">
            <textarea
              className="field min-h-20"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="לדוגמה: חסר צילום מדבקה ותיק מכון לא נפתח"
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setReturnModel(null)}>ביטול</Btn>
            <Btn
              variant="dark"
              onClick={() => {
                if (!returnModel) return;
                setApproval(returnModel, "returned", returnNote);
                setReturnModel(null);
              }}
            >
              החזרה להשלמות
            </Btn>
          </div>
        </div>
      </Modal>

      <ModelEditModal
        open={editOpen}
        model={editing}
        busy={busy}
        onClose={() => setEditOpen(false)}
        onSave={async (fields, approvalStatus) => {
          setBusy(true);
          try {
            if (editing) {
              await apiSend(`/api/models/${editing.id}`, "PATCH", { fields });
              toast.push("success", "הדגם עודכן");
            } else {
              await apiSend("/api/models", "POST", { ...fields, approvalStatus });
              toast.push("success", "הדגם נוסף למאגר");
            }
            setEditOpen(false);
            load();
          } catch (err) {
            toast.push("error", err instanceof Error ? err.message : "השמירה נכשלה");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function ModelEditModal({
  open, model, busy, onClose, onSave,
}: {
  open: boolean;
  model: ToolModel | null;
  busy: boolean;
  onClose: () => void;
  onSave: (fields: Partial<ToolModel>, approvalStatus: ApprovalStatus) => void;
}) {
  const [fields, setFields] = useState({ commercialName: "", manufacturerCode: "", manufacturer: "", category: "", country: "", notes: "" });
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>("pending");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setFields({
        commercialName: model?.commercialName ?? "",
        manufacturerCode: model?.manufacturerCode ?? "",
        manufacturer: model?.manufacturer ?? "",
        category: model?.category ?? "אופניים חשמליים",
        country: model?.country ?? "",
        notes: model?.notes ?? "",
      });
      setApprovalStatus(model?.approval.status ?? "pending");
      setErr("");
    }
  }, [open, model]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fields.commercialName.trim()) {
      setErr("נדרש שם מסחרי");
      return;
    }
    onSave(fields, approvalStatus);
  }

  return (
    <Modal open={open} onClose={onClose} title={model ? `עריכת דגם — ${model.commercialName}` : "דגם חדש"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="שם מסחרי" error={err}>
          <input className="field" value={fields.commercialName} onChange={(e) => setFields((f) => ({ ...f, commercialName: e.target.value }))} placeholder="CORTEZ MAX 2 2027" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="קוד דגם של היצרן">
            <input className="field" dir="ltr" value={fields.manufacturerCode} onChange={(e) => setFields((f) => ({ ...f, manufacturerCode: e.target.value }))} placeholder="CZ-MX2-27" />
          </Field>
          <Field label="יצרן">
            <input className="field" value={fields.manufacturer} onChange={(e) => setFields((f) => ({ ...f, manufacturer: e.target.value }))} />
          </Field>
          <Field label="קטגוריית כלי">
            <select className="field" value={fields.category} onChange={(e) => setFields((f) => ({ ...f, category: e.target.value }))}>
              <option value="אופניים חשמליים">אופניים חשמליים</option>
              <option value="קורקינטים חשמליים">קורקינטים חשמליים</option>
            </select>
          </Field>
          <Field label="ארץ ייצור">
            <input className="field" value={fields.country} onChange={(e) => setFields((f) => ({ ...f, country: e.target.value }))} />
          </Field>
        </div>
        <Field label="הערות">
          <textarea className="field min-h-20" value={fields.notes} onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))} />
        </Field>
        {!model && (
          <Field label="סטטוס אישור פנימי התחלתי">
            <select className="field" value={approvalStatus} onChange={(e) => setApprovalStatus(e.target.value as ApprovalStatus)}>
              <option value="pending">ממתין לאישור</option>
              <option value="approved">מאושר פנימית</option>
              <option value="returned">הוחזר להשלמות</option>
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Btn variant="ghost" type="button" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" loading={busy}>שמירה</Btn>
        </div>
      </form>
    </Modal>
  );
}
