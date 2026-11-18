"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/client";
import { Badge, EmptyState, PageHeader, ListSkeleton, fmtDate } from "@/components/ui";
import { CALL_STATUS_LABELS } from "@/lib/types";
import type { ServiceCall, ServiceCallStatus } from "@/lib/types";

type CallRow = ServiceCall & { modelName: string };

const TONES: Record<ServiceCallStatus, "red" | "blue" | "amber" | "gray" | "green" | "dark"> = {
  new: "red",
  inProgress: "amber",
  awaitingInfo: "gray",
  awaitingPart: "purple" as never,
  resolved: "green",
  closed: "dark",
};

export default function ServiceCallsPage() {
  const [rows, setRows] = useState<CallRow[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const data = await apiGet<{ calls: CallRow[] }>("/api/service-calls");
    setRows(data.calls);
  }, []);

  useEffect(() => { load().catch(() => setRows([])); }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((c) => {
      if (status && c.status !== status) return false;
      if (!needle) return true;
      return [c.callNumber, c.modelName, c.agentName, c.description, c.frameNumber ?? "", c.contactName ?? ""]
        .join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, status]);

  if (!rows) return <ListSkeleton rows={5} />;

  const isNewForMe = (c: CallRow) => c.status === "new" || c.status === "awaitingPart";

  return (
    <div>
      <PageHeader
        title="קריאות שירות"
        subtitle={`${rows.length} קריאות · סוכנים פותחים קריאה מהנייד והיבואן מטפל`}
        actions={
          <Link
            href="/service/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-cz-red px-6 text-[15px] font-bold text-white shadow-[0_6px_16px_rgba(200,10,4,.25)] hover:bg-cz-red-dark"
          >
            + קריאת שירות חדשה
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <input className="field pe-10" placeholder="חיפוש לפי מספר, דגם, סוכן, תיאור…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-cz-fog">🔍</span>
        </div>
        <select className="field w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {Object.entries(CALL_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🛠️" title="אין קריאות להצגה" hint="פתחו קריאה חדשה או שנו את הסינון" />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/service/${c.id}`} className="card block p-4 transition-shadow hover:shadow-md sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-lg font-bold text-cz-red">{c.callNumber}</span>
                    <span className="font-display font-extrabold">{c.modelName}</span>
                    {c.frameNumber && <span className="text-sm text-cz-mut">שלדה {c.frameNumber}</span>}
                  </div>
                  <p className="mt-1 line-clamp-1 max-w-xl text-sm text-cz-mut">{c.description}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-cz-fog">
                    <span>{c.agentName}</span>
                    <span>נפתחה {fmtDate(c.createdAt)}</span>
                    {c.assignee && <span className="font-bold text-cz-ink">אחראי: {c.assignee}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isNewForMe(c) && <span className="size-2.5 animate-pulse rounded-full bg-cz-red" />}
                  <Badge tone={TONES[c.status]}>{CALL_STATUS_LABELS[c.status]}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
