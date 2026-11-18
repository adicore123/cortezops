"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/client";
import { Badge, Btn, EmptyState, ListSkeleton, PageHeader, fmtDateTime } from "@/components/ui";
import { RepairFormModal } from "@/components/repairs/RepairForm";
import type { RepairRow, RepairPartOption } from "@/components/repairs/RepairForm";
import { REPAIR_DEVICE_LABELS, REPAIR_STATUS_LABELS } from "@/lib/types";
import type { ToolModel } from "@/lib/types";

export default function RepairDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [repair, setRepair] = useState<RepairRow | null>(null);
  const [models, setModels] = useState<ToolModel[]>([]);
  const [parts, setParts] = useState<RepairPartOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [repairData, modelData] = await Promise.all([
        apiGet<{ repair: RepairRow; parts: RepairPartOption[] }>(`/api/repairs/${params.id}`),
        apiGet<{ models: ToolModel[] }>("/api/models"),
      ]);
      setRepair({ ...repairData.repair, usedPartNames: repairData.repair.usedPartNames ?? [] });
      setModels(modelData.models.filter((model) => !model.archived));
      setParts(repairData.parts ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "טעינת התיקון נכשלה");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ListSkeleton rows={4} />;
  if (error || !repair) return <EmptyState title="התיקון לא זמין" hint={error} action={<Link href="/repairs"><Btn variant="outline">חזרה לתיקונים</Btn></Link>} />;

  return (
    <div className="space-y-5">
      <Link href="/repairs" className="inline-flex min-h-11 items-center text-sm font-bold text-cz-red hover:underline">← חזרה לתיקונים</Link>
      <PageHeader
        title={`תיקון ${repair.repairNumber}`}
        subtitle={`${REPAIR_DEVICE_LABELS[repair.deviceType]} · ${repair.modelName}${repair.serialNumber ? ` · ${repair.serialNumber}` : ""}`}
        actions={<Badge tone={repair.status === "completed" ? "green" : repair.status === "inProgress" ? "blue" : "red"}>{REPAIR_STATUS_LABELS[repair.status]}</Badge>}
      />

      <RepairFormModal
        open
        asPage
        repair={repair}
        models={models}
        parts={parts}
        onClose={() => router.push("/repairs")}
        onSaved={load}
      />

      <section className="card p-4 sm:p-6">
        <h2 className="font-display text-lg font-extrabold">היסטוריית התיקון</h2>
        <ol className="mt-4 space-y-3 border-s-2 border-cz-line ps-5">
          {[...(repair.history ?? [])].reverse().map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="relative text-sm">
              <span className="absolute -start-[27px] top-1 size-3 rounded-full bg-cz-red" />
              <div className="font-bold">{entry.action}{entry.from ? ` · ${entry.from}` : ""}{entry.to ? ` → ${entry.to}` : ""}</div>
              <div className="text-xs text-cz-fog">{entry.user} · {fmtDateTime(entry.at)}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
