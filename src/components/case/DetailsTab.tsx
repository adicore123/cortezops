"use client";

import { useEffect, useState } from "react";
import { apiSend } from "@/lib/client";
import { Btn, Field } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import { CASE_STATUS_LABELS } from "@/lib/types";
import type { CaseStatus } from "@/lib/types";
import type { CaseDetailData } from "@/app/(shell)/cases/[id]/page";

/** לשונית פרטי תיק: ניהול, הזמנה ומשלוח, בדיקה, צ׳קליסטת השלמות */
export default function DetailsTab({ data, reload }: { data: CaseDetailData; reload: () => void }) {
  const toast = useToast();
  const kase = data.case;
  const [busy, setBusy] = useState(false);
  const [mgmt, setMgmt] = useState({ sampleId: "", owner: "", dueDate: "", nextAction: "", notes: "", status: "draft" as CaseStatus });
  const [order, setOrder] = useState<Record<string, string>>({});
  const [insp, setInsp] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    setMgmt({
      sampleId: kase.sampleId ?? "",
      owner: kase.owner ?? "",
      dueDate: kase.dueDate?.slice(0, 10) ?? "",
      nextAction: kase.nextAction ?? "",
      notes: kase.notes ?? "",
      status: kase.status,
    });
    setOrder(Object.fromEntries(Object.entries(kase.order).map(([k, v]) => [k, v ?? ""])));
    setInsp(Object.fromEntries(Object.entries(kase.inspection).map(([k, v]) => [k, v ?? ""])));
  }, [kase]);

  async function save() {
    setBusy(true);
    try {
      await apiSend(`/api/cases/${kase.id}`, "PATCH", {
        fields: {
          sampleId: mgmt.sampleId,
          owner: mgmt.owner,
          dueDate: mgmt.dueDate || undefined,
          nextAction: mgmt.nextAction,
          notes: mgmt.notes,
        },
        order,
        inspection: insp,
        status: mgmt.status !== kase.status ? mgmt.status : undefined,
      });
      toast.push("success", "פרטי התיק נשמרו");
      reload();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function toggleChecklist(id: string) {
    try {
      await apiSend(`/api/cases/${kase.id}`, "PATCH", { checklistToggle: id });
      reload();
    } catch {
      toast.push("error", "העדכון נכשל");
    }
  }

  async function addChecklist() {
    if (!newItem.trim()) return;
    try {
      await apiSend(`/api/cases/${kase.id}`, "PATCH", { checklistAdd: newItem.trim() });
      setNewItem("");
      reload();
    } catch {
      toast.push("error", "הוספת ההשלמה נכשלה");
    }
  }

  async function removeChecklist(id: string) {
    try {
      await apiSend(`/api/cases/${kase.id}`, "PATCH", { checklistRemove: id });
      reload();
    } catch {
      toast.push("error", "ההסרה נכשלה");
    }
  }

  const orderFields: [keyof typeof order, string][] = [
    ["customer", "שם הפונה / מזמין"], ["orderDate", "תאריך פנייה / הזמנה"], ["instituteRequestNo", "מספר בקשה במכון"],
    ["sampleTakenAt", "תאריך נטילת המדגם"], ["sampleQuantity", "כמות במשלוח"], ["waybill", "מספר משלוח / שטר מטען"],
    ["port", "נמל"], ["entryDate", "תאריך כניסה"], ["supplier", "ספק"], ["supplierAccount", "מספר חשבון / פקטורה"],
    ["invoiceDate", "תאריך חשבון"],
  ];
  const inspFields: [keyof typeof insp, string, boolean?][] = [
    ["certificateNo", "מספר תעודת בדיקה", true], ["labSampleNo", "מספר בקשה פנימי במעבדה", true],
    ["lab", "מעבדה"], ["standardNo", "מספר תקן (למשל 15194)", true], ["procedureNo", "מספר נוהל (למשל ח-02-2019)"],
    ["issueDate", "תאריך הפקה"], ["inspectorName", "שם הבודק בתעודה"],
    ["essence", "מהות הבדיקה"], ["conclusion", "מסקנת הבדיקה (כפי שנרשמה בתעודה)"],
  ];

  return (
    <div className="space-y-5">
      {/* ניהול התיק */}
      <section className="card p-5">
        <h2 className="mb-4 font-display text-lg font-extrabold">ניהול התיק</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="מזהה מדגם / מספר שלדה">
            <input className="field" dir="ltr" value={mgmt.sampleId} onChange={(e) => setMgmt({ ...mgmt, sampleId: e.target.value })} />
          </Field>
          <Field label="אחראי">
            <input className="field" value={mgmt.owner} onChange={(e) => setMgmt({ ...mgmt, owner: e.target.value })} />
          </Field>
          <Field label="מועד יעד">
            <input type="date" className="field" value={mgmt.dueDate} onChange={(e) => setMgmt({ ...mgmt, dueDate: e.target.value })} />
          </Field>
          <Field label="סטטוס">
            <select className="field" value={mgmt.status} onChange={(e) => setMgmt({ ...mgmt, status: e.target.value as CaseStatus })}>
              {Object.entries(CASE_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="הפעולה הבאה">
            <input className="field" value={mgmt.nextAction} onChange={(e) => setMgmt({ ...mgmt, nextAction: e.target.value })} placeholder="למשל: קבלת בדיקה חוזרת" />
          </Field>
          <Field label="הערות">
            <input className="field" value={mgmt.notes} onChange={(e) => setMgmt({ ...mgmt, notes: e.target.value })} />
          </Field>
        </div>
      </section>

      {/* הזמנה ומשלוח */}
      <section className="card p-5">
        <h2 className="mb-4 font-display text-lg font-extrabold">הזמנה ומשלוח</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderFields.map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                className="field"
                type={key.includes("Date") || key === "entryDate" || key === "sampleTakenAt" ? "date" : "text"}
                dir={key === "waybill" || key === "supplierAccount" ? "ltr" : undefined}
                value={order[key] ?? ""}
                onChange={(e) => setOrder({ ...order, [key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </section>

      {/* בדיקה */}
      <section className="card p-5">
        <h2 className="mb-4 font-display text-lg font-extrabold">בדיקה</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inspFields.map(([key, label]) => (
            <Field key={key} label={label} className={key === "essence" || key === "conclusion" ? "sm:col-span-2 lg:col-span-3" : ""}>
              {key === "conclusion" || key === "essence" ? (
                <textarea className="field min-h-16" value={insp[key] ?? ""} onChange={(e) => setInsp({ ...insp, [key]: e.target.value })} />
              ) : (
                <input
                  className="field"
                  type={key === "testDate" || key === "issueDate" ? "date" : "text"}
                  dir={key === "certificateNo" || key === "standardNo" ? "ltr" : undefined}
                  value={insp[key] ?? ""}
                  onChange={(e) => setInsp({ ...insp, [key]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
        {/* תאריכי בדיקה כטווח — כפי שמופיע בתעודה: "הבדיקה בוצעה בין התאריכים" */}
        <div className="mt-2 grid gap-4 rounded-2xl border border-cz-line-soft bg-cz-bg p-4 sm:grid-cols-2">
          <Field label="הבדיקה בוצעה בין התאריכים — מ">
            <input type="date" className="field" value={insp.testFrom ?? ""} onChange={(e) => setInsp({ ...insp, testFrom: e.target.value })} />
          </Field>
          <Field label="עד">
            <input type="date" className="field" value={insp.testTo ?? ""} onChange={(e) => setInsp({ ...insp, testTo: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 rounded-2xl border border-cz-line-soft bg-cz-sand/60 p-4">
          <Field label="תוצאת הבדיקה הרשמית (מתעדכן מתוך אסמכתה)">
            <input className="field bg-white" value={insp.officialResult ?? ""} onChange={(e) => setInsp({ ...insp, officialResult: e.target.value })} placeholder="למשל: עבר בהתאמה מלאה לאחר תיקון" />
          </Field>
        </div>
      </section>

      {/* צ׳קליסטת השלמות */}
      <section className="card p-5">
        <h2 className="mb-4 font-display text-lg font-extrabold">השלמות נדרשות לתיק</h2>
        <ul className="space-y-2">
          {kase.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-cz-line-soft px-3 py-2.5">
              <button
                onClick={() => toggleChecklist(item.id)}
                className={`grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors ${item.done ? "border-cz-green bg-cz-green text-white" : "border-cz-line hover:border-cz-green"}`}
                aria-label={item.done ? "בטל סימון" : "סמן כהושלם"}
              >
                {item.done && <span className="text-sm font-bold">✓</span>}
              </button>
              <span className={`text-sm font-semibold ${item.done ? "text-cz-fog line-through" : ""}`}>{item.label}</span>
              <button onClick={() => removeChecklist(item.id)} className="ms-auto text-xs text-cz-fog hover:text-cz-red">הסרה</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            className="field flex-1"
            placeholder="השלמה חדשה, למשל: צילום מדבקה מתוקנת"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklist())}
          />
          <Btn variant="outline" onClick={addChecklist}>הוספה</Btn>
        </div>
      </section>

      <div className="flex justify-end">
        <Btn onClick={save} loading={busy} size="lg">שמירת פרטי התיק</Btn>
      </div>
    </div>
  );
}
