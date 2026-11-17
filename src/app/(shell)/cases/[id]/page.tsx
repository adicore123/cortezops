"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import { Badge, EmptyState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { CASE_STATUS_LABELS, DEFECT_STATUS_LABELS } from "@/lib/types";
import type { InspectionCase, Defect, CaseDocument, ToolModel, StoredFile, CaseStatus } from "@/lib/types";
import DetailsTab from "@/components/case/DetailsTab";
import DefectsTab from "@/components/case/DefectsTab";
import DocumentsTab from "@/components/case/DocumentsTab";
import QuickAttachModal from "@/components/case/QuickAttachModal";

export interface CaseDetailData {
  case: InspectionCase;
  model: ToolModel | null;
  defects: Defect[];
  documents: (CaseDocument & { file: StoredFile | null })[];
}

const TABS = [
  { key: "details", label: "פרטי תיק" },
  { key: "defects", label: "ליקויים" },
  { key: "documents", label: "מסמכים" },
  { key: "history", label: "היסטוריה" },
] as const;

const STATUS_TONES: Record<CaseStatus, "gray" | "blue" | "amber" | "purple" | "green"> = {
  draft: "gray",
  open: "blue",
  inProgress: "amber",
  awaitingInstitute: "purple",
  completed: "green",
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CaseDetailData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("details");
  const [attachOpen, setAttachOpen] = useState(false);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && TABS.some((x) => x.key === t)) setTab(t as typeof tab);
  }, [searchParams]);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<CaseDetailData>(`/api/cases/${id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינה נכשלה");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (error) return <EmptyState icon="⚠️" title="טעינת התיק נכשלה" hint={error} />;
  if (!data) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  const { case: kase, model, defects, documents } = data;
  const openDefects = defects.filter((d) => d.status !== "verified").length;
  const awaiting = defects.filter((d) => d.status === "awaitingVerification").length;
  const missing = kase.checklist.filter((i) => !i.done);

  return (
    <div>
      <PageHeader
        title={kase.caseNumber}
        subtitle={
          <>
            {model && <Link href={`/models/${model.id}`} className="font-bold hover:text-cz-red">{model.commercialName}</Link>}
            {kase.sampleId && <span className="text-cz-mut"> · מדגם {kase.sampleId}</span>}
            <span className="text-cz-mut"> · נפתח {fmtDate(kase.openedAt)}</span>
          </>
        }
        actions={
          <>
            <Badge tone={STATUS_TONES[kase.status]}>{CASE_STATUS_LABELS[kase.status]}</Badge>
            {openDefects > 0 && <Badge tone="red">{openDefects} ליקויים פתוחים</Badge>}
            {awaiting > 0 && <Badge tone="purple">ממתין לאימות</Badge>}
            <button
              onClick={() => setAttachOpen(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cz-red px-5 text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(200,10,4,.25)] transition-all hover:bg-cz-red-dark"
            >
              📄 צרף PDF
            </button>
          </>
        }
      />

      <QuickAttachModal
        open={attachOpen}
        caseId={kase.id}
        defects={defects}
        onClose={() => setAttachOpen(false)}
        onSaved={load}
      />

      {/* שורת מצב: הפעולה הבאה + פריטים חסרים */}
      {(kase.nextAction || missing.length > 0) && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {kase.nextAction && (
            <div className="rounded-full bg-cz-sand px-4 py-2 text-sm font-bold">הפעולה הבאה: {kase.nextAction}</div>
          )}
          {missing.length > 0 && (
            <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800">
              חסרים {missing.length}: {missing.map((m) => m.label).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* לשוניות */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-cz-line-soft bg-white p-1">
        {TABS.map((t) => {
          const count =
            t.key === "defects" ? defects.length : t.key === "documents" ? documents.length : undefined;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold transition-colors ${
                tab === t.key ? "bg-cz-ink text-white" : "text-cz-mut hover:bg-cz-bg"
              }`}
            >
              {t.label}
              {count !== undefined && count > 0 && <span className="num ms-1.5 opacity-80">{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === "details" && <DetailsTab data={data} reload={load} />}
      {tab === "defects" && <DefectsTab data={data} reload={load} />}
      {tab === "documents" && <DocumentsTab data={data} reload={load} />}

      {tab === "history" && (
        <div className="card p-5">
          <h2 className="mb-4 font-display text-lg font-extrabold">היסטוריית התיק</h2>
          <ol className="relative space-y-4 border-s-2 border-cz-line ps-5">
            {[...kase.history].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span className="absolute -start-[27px] top-1 size-3 rounded-full bg-cz-red" />
                <div className="text-sm font-bold">
                  {h.action}
                  {h.to && <span className="text-cz-mut"> → {h.to}</span>}
                </div>
                <div className="text-xs text-cz-fog">
                  {h.user} · {new Date(h.at).toLocaleString("he-IL")}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
