"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import { Badge, EmptyState, Spinner, fmtDate } from "@/components/ui";
import BackLink from "@/components/BackLink";
import { APPROVAL_LABELS, CASE_STATUS_LABELS, CALL_STATUS_LABELS, DOC_TYPE_LABELS, REPAIR_STATUS_LABELS } from "@/lib/types";
import type { ToolModel, InspectionCase, Part, ServiceCall, Repair, ApprovalStatus } from "@/lib/types";

interface ModelDocument {
  id: string;
  caseId: string;
  caseNumber: string;
  title: string;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface ModelHistory {
  at: string;
  action: string;
  user?: string;
  caseNumber?: string;
}

interface ModelDetail {
  model: ToolModel;
  cases?: (InspectionCase & { openDefects: number })[];
  parts?: Part[];
  serviceCalls: ServiceCall[];
  repairs?: Repair[];
  documents?: ModelDocument[];
  history?: ModelHistory[];
}

const APPROVAL_TONES: Record<ApprovalStatus, "green" | "amber" | "red"> = {
  approved: "green",
  pending: "amber",
  returned: "red",
};

const TAB_KEYS = ["overview", "cases", "parts", "repairs", "service", "documents", "history"] as const;

export default function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ModelDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    apiGet<ModelDetail>(`/api/models/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  // טאב מבוקש בכתובת (?tab=) — כמו בדף תיק
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && (TAB_KEYS as readonly string[]).includes(t)) setTab(t);
  }, [searchParams]);

  if (error) return <EmptyState icon="⚠️" title="טעינת הדגם נכשלה" hint={error} />;
  if (!data) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  const { model, cases, parts, serviceCalls, repairs = [], documents, history } = data;
  const hasCasesAccess = cases !== undefined;
  const hasPartsAccess = parts !== undefined;

  const TABS = [
    { key: "overview", label: "סקירה", show: true },
    { key: "cases", label: "תיקי מכון", show: hasCasesAccess, count: cases?.length },
    { key: "parts", label: "חלפים", show: hasPartsAccess, count: parts?.length },
    { key: "repairs", label: "תיקונים", show: true, count: repairs.length },
    { key: "service", label: "קריאות שירות", show: true, count: serviceCalls.length },
    { key: "documents", label: "מסמכים", show: hasCasesAccess, count: documents?.length },
    { key: "history", label: "היסטוריה", show: hasCasesAccess },
  ].filter((t) => t.show);

  // אם הטאב המבוקש לא גלוי למשתמש (אין הרשאה) — חזרה לסקירה
  const activeTab = TABS.some((t) => t.key === tab) ? tab : "overview";

  return (
    <div>
      <BackLink href="/models" label="חזרה לדגמים" />
      {/* כותרת הדגם — Product Hub */}
      <div className="card mb-5 flex flex-col gap-5 p-5 sm:flex-row sm:items-stretch">
        <div className="grid aspect-[4/3] w-full shrink-0 place-items-center overflow-hidden rounded-2xl bg-cz-sand sm:aspect-auto sm:h-48 sm:w-64">
          {model.imageFileId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${model.imageFileId}`} alt={model.commercialName} className="h-full w-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-14 text-cz-line" aria-hidden>
              <path d="M15 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 17c0-3 3-4.5 6-4.5s6 1.5 6 4.5v2H4zM17.5 8l3.5 6h-7z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-[28px]">{model.commercialName}</h1>
              <p className="mt-1 text-sm text-cz-mut">
                {[model.category, model.manufacturer, model.manufacturerCode && `קוד ${model.manufacturerCode}`, model.country]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {model.archived && <Badge tone="gray">בארכיון</Badge>}
              <Badge tone={APPROVAL_TONES[model.approval.status]}>{APPROVAL_LABELS[model.approval.status]}</Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {hasCasesAccess && <Badge tone="blue">{cases!.length} תיקי מכון</Badge>}
            {hasPartsAccess && <Badge tone="gray">{parts!.length} חלפים תואמים</Badge>}
            <Badge tone={serviceCalls.some((c) => c.status !== "resolved" && c.status !== "closed") ? "red" : "gray"}>
              {serviceCalls.length} קריאות שירות
            </Badge>
          </div>
        </div>
      </div>

      {/* לשוניות */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-cz-line-soft bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
              activeTab === t.key ? "bg-cz-ink text-white" : "text-cz-mut hover:bg-cz-bg"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && <span className="num ms-1.5 opacity-80">{t.count}</span>}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-3 font-display text-lg font-extrabold">פרטי הדגם</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="text-xs text-cz-fog">קוד יצרן</dt><dd className="num font-bold">{model.manufacturerCode || "—"}</dd></div>
              <div><dt className="text-xs text-cz-fog">יצרן</dt><dd className="font-bold">{model.manufacturer || "—"}</dd></div>
              <div><dt className="text-xs text-cz-fog">קטגוריה</dt><dd className="font-bold">{model.category || "—"}</dd></div>
              <div><dt className="text-xs text-cz-fog">ארץ ייצור</dt><dd className="font-bold">{model.country || "—"}</dd></div>
              <div><dt className="text-xs text-cz-fog">נוסף</dt><dd className="font-bold">{fmtDate(model.createdAt)}</dd></div>
              <div><dt className="text-xs text-cz-fog">עודכן</dt><dd className="font-bold">{fmtDate(model.updatedAt)}</dd></div>
            </dl>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-display text-lg font-extrabold">אישור פנימי</h2>
            <p className="text-sm">
              <Badge tone={APPROVAL_TONES[model.approval.status]}>{APPROVAL_LABELS[model.approval.status]}</Badge>
            </p>
            {model.approval.approver && (
              <p className="mt-2 text-sm text-cz-mut">
                אושר ע&quot;י {model.approval.approver} · {fmtDate(model.approval.date)}
                {model.approval.note && <span> — {model.approval.note}</span>}
              </p>
            )}
            {model.notes && <p className="mt-4 border-t border-cz-line-soft pt-4 text-sm text-cz-mut">{model.notes}</p>}
          </section>
        </div>
      )}

      {activeTab === "cases" && hasCasesAccess && (
        <section className="card p-5">
          {cases!.length === 0 ? (
            <p className="text-sm text-cz-fog">אין תיקים לדגם זה</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {cases!.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/cases/${c.id}`} className="font-bold hover:text-cz-red">
                    {c.caseNumber} <span className="font-normal text-cz-mut">· {c.sampleId || "ללא מזהה מדגם"}</span>
                  </Link>
                  <span className="flex items-center gap-2 text-xs">
                    {c.openDefects > 0 && <Badge tone="red">{c.openDefects} ליקויים פתוחים</Badge>}
                    <Badge tone={c.status === "completed" ? "green" : c.status === "draft" ? "gray" : "blue"}>{CASE_STATUS_LABELS[c.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "parts" && hasPartsAccess && (
        <section className="card p-5">
          {parts!.length === 0 ? (
            <p className="text-sm text-cz-fog">אין חלפים משויכים</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {parts!.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/parts?q=${encodeURIComponent(p.sku)}`} className="font-bold hover:text-cz-red">{p.name}</Link>
                  <span className="text-cz-mut"><span className="num">{p.sku}</span> · כמות <span className="num">{p.qty}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "repairs" && (
        <section className="card p-5">
          {repairs.length === 0 ? (
            <p className="text-sm text-cz-fog">אין תיקונים רשומים לדגם זה</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {repairs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/repairs/${r.id}`} className="font-bold hover:text-cz-red">
                    <span className="num text-cz-red">{r.repairNumber}</span>
                    {r.serialNumber && <span className="num font-normal text-cz-mut"> · סידורי {r.serialNumber}</span>}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="max-w-60 truncate text-xs text-cz-mut">{r.faultDescription}</span>
                    {r.delayReason && <Badge tone="amber">מתעכב</Badge>}
                    <Badge tone={r.status === "completed" ? "green" : r.status === "waiting" ? "red" : "blue"}>
                      {REPAIR_STATUS_LABELS[r.status]}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "service" && (
        <section className="card p-5">
          {serviceCalls.length === 0 ? (
            <p className="text-sm text-cz-fog">אין קריאות לדגם זה</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {serviceCalls.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/service/${c.id}`} className="font-bold hover:text-cz-red">
                    {c.callNumber} <span className="font-normal text-cz-mut">· {c.agentName}</span>
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="max-w-60 truncate text-xs text-cz-mut">{c.description}</span>
                    <Badge tone={c.status === "resolved" || c.status === "closed" ? "green" : c.status === "new" ? "red" : "blue"}>{CALL_STATUS_LABELS[c.status]}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "documents" && hasCasesAccess && (
        <section className="card p-5">
          {documents!.length === 0 ? (
            <p className="text-sm text-cz-fog">אין מסמכים בתיקי הדגם</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {documents!.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/cases/${d.caseId}?tab=documents`} className="font-bold hover:text-cz-red">
                    {d.title} <span className="font-normal text-cz-mut">· תיק {d.caseNumber}</span>
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-cz-fog">
                    <span>{DOC_TYPE_LABELS[d.type as keyof typeof DOC_TYPE_LABELS] ?? d.type}</span>
                    <span>· {fmtDate(d.uploadedAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "history" && hasCasesAccess && (
        <div className="card p-5">
          <h2 className="mb-4 font-display text-lg font-extrabold">היסטוריית הדגם</h2>
          {history!.length === 0 ? (
            <p className="text-sm text-cz-fog">אין אירועים רשומים</p>
          ) : (
            <ol className="relative space-y-4 border-s-2 border-cz-line ps-5">
              {history!.map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[27px] top-1 size-3 rounded-full bg-cz-red" />
                  <div className="text-sm font-bold">
                    {h.action}
                    {h.caseNumber && <span className="text-cz-mut"> · תיק {h.caseNumber}</span>}
                  </div>
                  <div className="text-xs text-cz-fog">
                    {h.user ? `${h.user} · ` : ""}{new Date(h.at).toLocaleString("he-IL")}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
