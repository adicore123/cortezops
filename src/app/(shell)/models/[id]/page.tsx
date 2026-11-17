"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import { Badge, EmptyState, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { APPROVAL_LABELS, CASE_STATUS_LABELS, CALL_STATUS_LABELS } from "@/lib/types";
import type { ToolModel, InspectionCase, Part, ServiceCall, DefectStatus, ApprovalStatus } from "@/lib/types";

interface ModelDetail {
  model: ToolModel;
  cases?: (InspectionCase & { openDefects: number })[];
  parts?: Part[];
  serviceCalls: ServiceCall[];
}

const APPROVAL_TONES: Record<ApprovalStatus, "green" | "amber" | "red"> = {
  approved: "green",
  pending: "amber",
  returned: "red",
};

export default function ModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ModelDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<ModelDetail>(`/api/models/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <EmptyState icon="⚠️" title="טעינת הדגם נכשלה" hint={error} />;
  if (!data) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  const { model, cases, parts, serviceCalls } = data;

  return (
    <div>
      <PageHeader
        title={model.commercialName}
        subtitle={[model.manufacturer, model.manufacturerCode && `קוד ${model.manufacturerCode}`, model.category, model.country].filter(Boolean).join(" · ")}
        actions={
          <>
            {model.archived && <Badge tone="gray">בארכיון</Badge>}
            <Badge tone={APPROVAL_TONES[model.approval.status]}>{APPROVAL_LABELS[model.approval.status]}</Badge>
          </>
        }
      />

      {model.approval.approver && (
        <div className="card mb-5 p-4 text-sm">
          <span className="font-bold">אישור פנימי:</span>{" "}
          {APPROVAL_LABELS[model.approval.status]} ע"י {model.approval.approver} · {fmtDate(model.approval.date)}
          {model.approval.note && <span className="text-cz-mut"> — {model.approval.note}</span>}
        </div>
      )}

      {model.notes && <div className="card mb-5 p-4 text-sm text-cz-mut">{model.notes}</div>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* תיקי מכון התקנים */}
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-extrabold">תיקי מכון התקנים</h2>
          {cases === undefined ? (
            <p className="text-sm text-cz-fog">אין הרשאה לצפייה בתיקים</p>
          ) : cases.length === 0 ? (
            <p className="text-sm text-cz-fog">אין תיקים לדגם זה</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
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

        {/* חלפים תואמים */}
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-extrabold">חלפים תואמים</h2>
          {parts === undefined ? (
            <p className="text-sm text-cz-fog">אין הרשאה לצפייה במלאי</p>
          ) : parts.length === 0 ? (
            <p className="text-sm text-cz-fog">אין חלפים משויכים</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {parts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <Link href={`/parts?q=${encodeURIComponent(p.sku)}`} className="font-bold hover:text-cz-red">{p.name}</Link>
                  <span className="text-cz-mut"><span className="num">{p.sku}</span> · כמות <span className="num">{p.qty}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* קריאות שירות */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-display text-lg font-extrabold">קריאות שירות מקושרות</h2>
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
      </div>
    </div>
  );
}
