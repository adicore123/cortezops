import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUserServer, canAccess } from "@/lib/auth";
import { getSettings, logoUrl } from "@/lib/settings";
import { readCollection, getById } from "@/lib/db/store";
import { ensureInit } from "@/lib/db/init";
import PrintControls from "@/components/PrintControls";
import { CASE_STATUS_LABELS, DEFECT_STATUS_LABELS } from "@/lib/types";
import type { InspectionCase, Defect, ToolModel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PrintCasePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  await ensureInit();
  const user = await getUserServer();
  if (!user) redirect("/login");
  if (!canAccess(user, "cases")) redirect("/");

  const { id } = await params;
  const [kase, settings, defects, models] = await Promise.all([
    getById<InspectionCase>("cases", id),
    getSettings(),
    readCollection<Defect>("defects"),
    readCollection<ToolModel>("models"),
  ]);
  if (!kase) redirect("/cases");

  const model = models.find((m) => m.id === kase.modelId);
  const caseDefects = defects.filter((d) => d.caseId === id);
  const missing = kase.checklist.filter((i) => !i.done);
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("he-IL") : "—");

  return (
    <div className="text-[13px] leading-relaxed text-black">
      {/* כפתורי בקרה — לא מודפסים */}
      <PrintControls />

      {/* כותרת עם לוגו */}
      <header className="mb-6 flex items-center justify-between border-b-2 border-black pb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl(settings)} alt={settings.importer.name} className="h-10 w-auto" />
        <div className="text-left">
          <div className="text-xl font-bold">סיכום תיק בדיקה</div>
          <div className="num text-lg font-bold">{kase.caseNumber}</div>
        </div>
      </header>

      {/* פרטי דגם ותיק */}
      <section className="mb-5 grid grid-cols-2 gap-x-8 gap-y-1">
        <div><b>דגם:</b> {model?.commercialName ?? "—"}</div>
        <div><b>קוד דגם:</b> {model?.manufacturerCode || "—"}</div>
        <div><b>מזהה מדגם / שלדה:</b> {kase.sampleId || "—"}</div>
        <div><b>סטטוס תיק:</b> {CASE_STATUS_LABELS[kase.status]}</div>
        <div><b>אחראי:</b> {kase.owner || "—"}</div>
        <div><b>תאריך פתיחה:</b> {fmt(kase.openedAt)}</div>
        <div><b>מועד יעד:</b> {fmt(kase.dueDate)}</div>
        <div><b>מספר תעודה:</b> {kase.inspection.certificateNo || "—"}</div>
        <div><b>בקשה פנימית במעבדה:</b> {kase.inspection.labSampleNo || "—"}</div>
        <div><b>בקשה במכון:</b> {kase.order.instituteRequestNo || "—"}</div>
        <div><b>תקן:</b> {kase.inspection.standardNo || "—"}</div>
        <div><b>נוהל:</b> {kase.inspection.procedureNo || "—"}</div>
        <div><b>מעבדה:</b> {kase.inspection.lab || "—"}</div>
        <div><b>בודק:</b> {kase.inspection.inspectorName || "—"}</div>
      </section>

      {/* פרטי בדיקה */}
      <section className="mb-5">
        <h2 className="mb-2 border-b border-black pb-1 text-base font-bold">פרטי הבדיקה</h2>
        <p>
          <b>תאריכי בדיקה:</b>{" "}
          {kase.inspection.testFrom || kase.inspection.testTo
            ? `${fmt(kase.inspection.testFrom)} — ${fmt(kase.inspection.testTo)}`
            : kase.inspection.testDate || "—"}
        </p>
        <p><b>מהות הבדיקה:</b> {kase.inspection.essence || "—"}</p>
        <p><b>מסקנת הבדיקה (כפי שנרשמה):</b> {kase.inspection.conclusion || "—"}</p>
        <p><b>תוצאה רשמית:</b> {kase.inspection.officialResult || "טרם נקלטה"}</p>
        {kase.order.supplier && (
          <p>
            <b>ספק:</b> {kase.order.supplier} {kase.order.supplierAccount && `· חשבון ${kase.order.supplierAccount}`} {kase.order.invoiceDate && `מ${fmt(kase.order.invoiceDate)}`} {kase.order.waybill && `· משלוח ${kase.order.waybill}`}
          </p>
        )}
      </section>

      {/* ליקויים */}
      <section className="mb-5">
        <h2 className="mb-2 border-b border-black pb-1 text-base font-bold">ליקויים ({caseDefects.length})</h2>
        {caseDefects.length === 0 ? (
          <p>אין ליקויים רשומים</p>
        ) : (
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1.5 pe-2 font-bold">#</th>
                <th className="py-1.5 pe-2 font-bold">קטגוריה</th>
                <th className="py-1.5 pe-2 font-bold">ליקוי</th>
                <th className="py-1.5 pe-2 font-bold">סעיף/עמוד</th>
                <th className="py-1.5 pe-2 font-bold">מצב טיפול</th>
              </tr>
            </thead>
            <tbody>
              {caseDefects.map((d, i) => (
                <tr key={d.id} className="border-b border-gray-300 align-top">
                  <td className="py-1.5 pe-2">{i + 1}</td>
                  <td className="py-1.5 pe-2">{d.category}</td>
                  <td className="py-1.5 pe-2">
                    <b>{d.title}</b>
                    {d.sticker.existingText && <div className="text-gray-600">כיתוב קיים: {d.sticker.existingText}</div>}
                    {d.sticker.updatedText && <div className="text-gray-600">נוסח מעודכן: {d.sticker.updatedText}</div>}
                  </td>
                  <td className="py-1.5 pe-2">{[d.certificateSection, d.certificatePage].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="py-1.5 pe-2">
                    {DEFECT_STATUS_LABELS[d.status]}
                    {d.needsRecheck && d.status !== "verified" && " (ממתין לבדיקה חוזרת)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* השלמות חסרות */}
      <section className="mb-5">
        <h2 className="mb-2 border-b border-black pb-1 text-base font-bold">השלמות</h2>
        {kase.checklist.length === 0 ? (
          <p>אין השלמות מוגדרות</p>
        ) : (
          <ul className="list-inside list-disc">
            {kase.checklist.map((item) => (
              <li key={item.id} className={item.done ? "text-gray-500" : ""}>
                {item.done ? "☑" : "☐"} {item.label}
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 && <p className="mt-1 font-bold">חסרים {missing.length} פריטים</p>}
      </section>

      <footer className="mt-8 border-t border-gray-400 pt-3 text-[11px] text-gray-600">
        {settings.importer.name} · {settings.importer.phone ?? ""} · הופק בתאריך {new Date().toLocaleString("he-IL")} ע"י {user.name}
      </footer>
    </div>
  );
}
