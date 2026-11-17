"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { Badge, Btn, Field, PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import { APPROVAL_LABELS } from "@/lib/types";
import type { ToolModel } from "@/lib/types";

export default function NewCasePage() {
  const router = useRouter();
  const toast = useToast();
  const [models, setModels] = useState<ToolModel[]>([]);
  const [modelId, setModelId] = useState("");
  const [newModel, setNewModel] = useState({ commercialName: "", manufacturerCode: "", manufacturer: "", category: "אופניים חשמליים", country: "סין" });
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [sampleId, setSampleId] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"draft" | "open">("draft");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ models: ToolModel[] }>("/api/models")
      .then((d) => setModels(d.models.filter((m) => !m.archived)))
      .catch(() => toast.push("error", "טעינת הדגמים נכשלה"));
  }, [toast]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "existing" && !modelId) {
      toast.push("error", "בחרו דגם מהמאגר או עברו ליצירת דגם חדש");
      return;
    }
    if (mode === "new" && !newModel.commercialName.trim()) {
      toast.push("error", "הזינו שם מסחרי לדגם החדש");
      return;
    }
    setBusy(true);
    try {
      const res = await apiSend<{ case: { id: string; caseNumber: string } }>("/api/cases", "POST", {
        modelId: mode === "existing" ? modelId : undefined,
        newModel: mode === "new" ? newModel : undefined,
        sampleId,
        owner,
        dueDate,
        notes,
        status,
      });
      toast.push("success", `התיק ${res.case.caseNumber ?? ""} נפתח`);
      router.push(`/cases/${res.case.id}`);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "פתיחת התיק נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="פתיחת תיק בדיקה"
        subtitle="אפשר לשמור טיוטה עכשיו ולהשלים את פרטי התעודה כשתגיע במייל"
      />

      <form onSubmit={submit} className="card space-y-5 p-5 sm:p-6">
        {/* בחירת דגם */}
        <div>
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "existing" ? "bg-cz-ink text-white" : "bg-cz-sand text-cz-mut"}`}
            >
              דגם קיים
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "new" ? "bg-cz-ink text-white" : "bg-cz-sand text-cz-mut"}`}
            >
              + דגם חדש מתוך הטופס
            </button>
          </div>

          {mode === "existing" ? (
            <Field label="בחירת דגם מהמאגר" hint="אפשר לפתוח תיק גם לדגם שטרם אושר פנימית">
              <select className="field" value={modelId} onChange={(e) => setModelId(e.target.value)}>
                <option value="">— בחרו דגם —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.commercialName} {m.approval.status !== "approved" ? `(${APPROVAL_LABELS[m.approval.status]})` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="grid gap-4 rounded-2xl bg-cz-bg p-4 sm:grid-cols-2">
              <Field label="שם מסחרי">
                <input className="field" value={newModel.commercialName} onChange={(e) => setNewModel((f) => ({ ...f, commercialName: e.target.value }))} placeholder="CORTEZ MIA" />
              </Field>
              <Field label="קוד דגם">
                <input className="field" dir="ltr" value={newModel.manufacturerCode} onChange={(e) => setNewModel((f) => ({ ...f, manufacturerCode: e.target.value }))} />
              </Field>
              <Field label="קטגוריה">
                <select className="field" value={newModel.category} onChange={(e) => setNewModel((f) => ({ ...f, category: e.target.value }))}>
                  <option>אופניים חשמליים</option>
                  <option>קורקינטים חשמליים</option>
                </select>
              </Field>
              <Field label="ארץ ייצור">
                <input className="field" value={newModel.country} onChange={(e) => setNewModel((f) => ({ ...f, country: e.target.value }))} />
              </Field>
              <div className="sm:col-span-2 text-xs text-cz-fog">הדגם החדש יישמר במאגר כממתין לאישור פנימי</div>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מזהה מדגם / מספר שלדה" hint="אם ידוע">
            <input className="field" dir="ltr" value={sampleId} onChange={(e) => setSampleId(e.target.value)} placeholder="SN-0000" />
          </Field>
          <Field label="אחראי">
            <input className="field" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="שם העובד" />
          </Field>
          <Field label="מועד יעד">
            <input type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
          <Field label="סטטוס פתיחה">
            <select className="field" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "open")}>
              <option value="draft">טיוטה — עדיין ממתינים לתעודה</option>
              <option value="open">פתוח</option>
            </select>
          </Field>
        </div>

        <Field label="הערות">
          <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Badge tone="gray">מספר התיק יוקצה אוטומטית</Badge>
          <div className="flex gap-2">
            <Btn variant="ghost" type="button" onClick={() => router.back()}>ביטול</Btn>
            <Btn type="submit" loading={busy}>{status === "draft" ? "שמירת טיוטה" : "פתיחת התיק"}</Btn>
          </div>
        </div>
      </form>
    </div>
  );
}
