"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import {
  Badge,
  Btn,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  ListSkeleton,
  Spinner,
  fmtDate,
  fmtDateTime,
} from "@/components/ui";
import { useToast } from "@/components/Toasts";
import ConfirmModal from "@/components/ConfirmModal";
import { RepairFormModal } from "@/components/repairs/RepairForm";
import type { RepairPartOption } from "@/components/repairs/RepairForm";
import {
  REPAIR_DEVICE_LABELS,
  REPAIR_DEVICE_CATEGORY,
  REPAIR_STATUS_LABELS,
} from "@/lib/types";
import type {
  Repair,
  RepairDeviceType,
  RepairStatus,
  ToolModel,
} from "@/lib/types";

type RepairRow = Repair & {
  modelName: string;
  modelCode?: string;
  usedPartNames: string[];
};

const STATUS_TONES: Record<RepairStatus, "red" | "blue" | "green"> = {
  waiting: "red",
  inProgress: "blue",
  completed: "green",
};

const STATUS_ORDER: RepairStatus[] = ["waiting", "inProgress", "completed"];

function matchModelToDevice(m: ToolModel, dt: RepairDeviceType): boolean {
  return !m.archived && m.category === REPAIR_DEVICE_CATEGORY[dt];
}

function RepairsInner() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<RepairRow[] | null>(null);
  const [models, setModels] = useState<ToolModel[]>([]);
  const [parts, setParts] = useState<RepairPartOption[]>([]);
  const [canManage, setCanManage] = useState(true);

  // חיפוש מתקדם וסינון
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [deviceFilter, setDeviceFilter] = useState<"" | RepairDeviceType>("");
  const [statusFilter, setStatusFilter] = useState<"" | RepairStatus>("");
  const [modelFilter, setModelFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "updated">("newest");
  const [delayedOnly, setDelayedOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // מודלים
  const [formOpen, setFormOpen] = useState(false);
  const [historyRepair, setHistoryRepair] = useState<RepairRow | null>(null);
  const [deleting, setDeleting] = useState<RepairRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [repData, modData] = await Promise.all([
        apiGet<{ repairs: RepairRow[]; parts: RepairPartOption[]; canManage: boolean }>("/api/repairs"),
        apiGet<{ models: ToolModel[] }>("/api/models"),
      ]);
      setRows(repData.repairs);
      setCanManage(repData.canManage);
      setModels(modData.models.filter((m) => !m.archived));
      setParts(repData.parts ?? []);
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "טעינת התיקונים נכשלה");
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const urlQ = searchParams.get("q");
    if (urlQ) setQ(urlQ);
  }, [searchParams]);

  const counts = useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      waiting: all.filter((r) => r.status === "waiting").length,
      inProgress: all.filter((r) => r.status === "inProgress").length,
      delayed: all.filter((r) => r.status !== "completed" && Boolean(r.delayReason?.trim())).length,
      completed: all.filter((r) => r.status === "completed").length,
      bicycles: all.filter((r) => r.deviceType === "bicycle").length,
      scooters: all.filter((r) => r.deviceType === "scooter").length,
    };
  }, [rows]);

  const filteredModelsForFilter = useMemo(() => {
    if (!deviceFilter) return models;
    return models.filter((m) => matchModelToDevice(m, deviceFilter));
  }, [models, deviceFilter]);

  const technicians = useMemo(() =>
    Array.from(new Set((rows ?? []).map((r) => r.technician?.trim()).filter((name): name is string => Boolean(name)))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (deviceFilter && r.deviceType !== deviceFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (modelFilter && r.modelId !== modelFilter) return false;
      if (technicianFilter && r.technician !== technicianFilter) return false;
      if (delayedOnly && (!r.delayReason?.trim() || r.status === "completed")) return false;
      if (dateFrom && r.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false;
      if (!needle) return true;
      const haystack = [
        r.repairNumber,
        r.modelName,
        r.modelCode ?? "",
        r.serialNumber,
        r.faultDescription,
        r.fixDescription ?? "",
        r.delayReason ?? "",
        r.customerName ?? "",
        r.customerPhone ?? "",
        r.technician ?? "",
        REPAIR_DEVICE_LABELS[r.deviceType],
        REPAIR_STATUS_LABELS[r.status],
        ...(r.usedPartNames ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    }).sort((a, b) => sortOrder === "oldest"
      ? a.createdAt.localeCompare(b.createdAt)
      : sortOrder === "updated"
        ? b.updatedAt.localeCompare(a.updatedAt)
        : b.createdAt.localeCompare(a.createdAt));
  }, [rows, q, deviceFilter, statusFilter, modelFilter, technicianFilter, delayedOnly, dateFrom, dateTo, sortOrder]);

  const hasActiveFilters = Boolean(
    q.trim() || deviceFilter || statusFilter || modelFilter || technicianFilter || delayedOnly || dateFrom || dateTo || sortOrder !== "newest"
  );

  function resetFilters() {
    setQ("");
    setDeviceFilter("");
    setStatusFilter("");
    setModelFilter("");
    setTechnicianFilter("");
    setSortOrder("newest");
    setDelayedOnly(false);
    setDateFrom("");
    setDateTo("");
    window.history.replaceState(null, "", "/repairs");
  }

  function updateQuery(value: string) {
    setQ(value);
    const params = new URLSearchParams(window.location.search);
    if (value.trim()) params.set("q", value);
    else params.delete("q");
    window.history.replaceState(null, "", params.size ? `/repairs?${params}` : "/repairs");
  }

  async function quickStatusChange(repair: RepairRow, nextStatus: RepairStatus) {
    if (repair.status === nextStatus) return;
    if (nextStatus === "completed" && !repair.fixDescription?.trim()) {
      toast.push("error", "יש לתאר מה תוקן לפני סיום התיקון");
      router.push(`/repairs/${repair.id}`);
      return;
    }
    try {
      await apiSend(`/api/repairs/${repair.id}`, "PATCH", { status: nextStatus });
      toast.push(
        "success",
        `סטטוס ${repair.repairNumber} עודכן ל"${REPAIR_STATUS_LABELS[nextStatus]}"`
      );
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "עדכון הסטטוס נכשל");
    }
  }

  async function deleteRepair() {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiSend(`/api/repairs/${deleting.id}`, "DELETE");
      toast.push("success", `התיקון ${deleting.repairNumber} נמחק`);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "המחיקה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <ListSkeleton rows={5} />;

  return (
    <div>
      <PageHeader
        title="תיקונים ומעבדה"
        subtitle="מעקב מהיר ונוח מהמובייל ומהמחשב: אופניים וקורקינטים, מספר סידורי, מה התקלה, מה תוקן וסיבת עיכוב"
        actions={
          <Btn
            onClick={() => {
              setFormOpen(true);
            }}
          >
            + תיקון חדש
          </Btn>
        }
      />

      {/* כרטיסי מצב מהירים — לחיצה מסננת מיד */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "waiting" ? "" : "waiting");
            setDelayedOnly(false);
          }}
          className={`card flex flex-col items-start p-3.5 text-start transition-all ${
            statusFilter === "waiting" ? "ring-2 ring-cz-red" : "hover:shadow-md"
          }`}
        >
          <span className="num text-2xl font-extrabold text-cz-red">{counts.waiting}</span>
          <span className="mt-0.5 text-xs font-bold text-cz-mut">ממתין לתיקון</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "inProgress" ? "" : "inProgress");
            setDelayedOnly(false);
          }}
          className={`card flex flex-col items-start p-3.5 text-start transition-all ${
            statusFilter === "inProgress" ? "ring-2 ring-sky-600" : "hover:shadow-md"
          }`}
        >
          <span className="num text-2xl font-extrabold text-sky-700">{counts.inProgress}</span>
          <span className="mt-0.5 text-xs font-bold text-cz-mut">בטיפול</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDelayedOnly((v) => !v);
            setStatusFilter("");
          }}
          className={`card flex flex-col items-start p-3.5 text-start transition-all ${
            delayedOnly ? "ring-2 ring-amber-500 bg-amber-50/40" : "hover:shadow-md"
          }`}
        >
          <span className="num text-2xl font-extrabold text-amber-600">{counts.delayed}</span>
          <span className="mt-0.5 text-xs font-bold text-cz-mut">מתעכבים בטיפול</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "completed" ? "" : "completed");
            setDelayedOnly(false);
          }}
          className={`card flex flex-col items-start p-3.5 text-start transition-all ${
            statusFilter === "completed" ? "ring-2 ring-cz-green" : "hover:shadow-md"
          }`}
        >
          <span className="num text-2xl font-extrabold text-cz-green">{counts.completed}</span>
          <span className="mt-0.5 text-xs font-bold text-cz-mut">תיקון הסתיים</span>
        </button>
      </div>

      {/* סרגל סינון וחיפוש מתקדם */}
      <div className="card mb-5 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* בחירת סוג מכשיר בלחיצת כפתור */}
          <div className="inline-flex rounded-full border border-cz-line-soft bg-cz-bg p-1">
            <button
              type="button"
              onClick={() => { setDeviceFilter(""); setModelFilter(""); }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                deviceFilter === "" ? "bg-cz-ink text-white" : "text-cz-mut hover:text-cz-ink"
              }`}
            >
              הכול ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => { setDeviceFilter(deviceFilter === "bicycle" ? "" : "bicycle"); setModelFilter(""); }}
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                deviceFilter === "bicycle" ? "bg-cz-red text-white" : "text-cz-mut hover:text-cz-ink"
              }`}
            >
              🚲 אופניים ({counts.bicycles})
            </button>
            <button
              type="button"
              onClick={() => { setDeviceFilter(deviceFilter === "scooter" ? "" : "scooter"); setModelFilter(""); }}
              className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                deviceFilter === "scooter" ? "bg-cz-red text-white" : "text-cz-mut hover:text-cz-ink"
              }`}
            >
              🛴 קורקינט ({counts.scooters})
            </button>
          </div>

          {/* חיפוש חופשי */}
          <div className="relative min-w-52 flex-1">
            <input
              className="field pe-10"
              placeholder="חיפוש לפי מס׳ סידורי, דגם, תקלה, מה תוקן, עיכוב, לקוח…"
              value={q}
              onChange={(e) => updateQuery(e.target.value)}
            />
            <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-cz-fog">
              🔍
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-xs font-bold transition-colors ${
              showAdvanced || modelFilter || technicianFilter || dateFrom || dateTo || sortOrder !== "newest"
                ? "border-cz-ink bg-cz-ink text-white"
                : "border-cz-line bg-white text-cz-ink hover:border-cz-red"
            }`}
          >
            ⚙️ חיפוש מתקדם
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-bold text-cz-red hover:bg-cz-red-soft"
            >
              ניקוי סינון ✕
            </button>
          )}
        </div>

        {/* שורת חיפוש מתקדם נפתחת */}
        {showAdvanced && (
          <div className="mt-3 grid gap-2.5 border-t border-cz-line-soft pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label text-xs">סינון לפי דגם</label>
              <select
                className="field"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
              >
                <option value="">כל הדגמים</option>
                {filteredModelsForFilter.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.commercialName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs">סטטוס תיקון</label>
              <select
                className="field"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "" | RepairStatus)}
              >
                <option value="">כל הסטטוסים</option>
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {REPAIR_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-xs">מטפל</label>
              <select className="field" value={technicianFilter} onChange={(e) => setTechnicianFilter(e.target.value)}>
                <option value="">כל המטפלים</option>
                {technicians.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            <div>
              <label className="label text-xs">מיון</label>
              <select className="field" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest" | "updated")}>
                <option value="newest">נפתחו לאחרונה</option>
                <option value="oldest">נפתחו ראשונים</option>
                <option value="updated">עודכנו לאחרונה</option>
              </select>
            </div>

            <div>
              <label className="label text-xs">מתאריך פתיחה</label>
              <input
                type="date"
                className="field"
                dir="ltr"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="label text-xs">עד תאריך פתיחה</label>
              <input
                type="date"
                className="field"
                dir="ltr"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <label className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border border-cz-line bg-cz-bg px-3.5 text-xs font-bold">
                <input
                  type="checkbox"
                  className="size-4 accent-cz-red"
                  checked={delayedOnly}
                  onChange={(e) => setDelayedOnly(e.target.checked)}
                />
                הצג רק כלים מתעכבים
              </label>
            </div>
          </div>
        )}
      </div>

      <p className="mb-3 text-xs font-semibold text-cz-mut">מוצגים {filtered.length} מתוך {counts.total} תיקונים</p>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔧"
          title="אין תיקונים להצגה"
          hint={
            hasActiveFilters
              ? "לא נמצאו תיקונים התואמים לסינון — נסו לנקות את החיפוש"
              : "פתחו כרטיס תיקון חדש לאופניים או קורקינט"
          }
          action={
            hasActiveFilters ? (
              <Btn variant="outline" onClick={resetFilters}>
                ניקוי סינון
              </Btn>
            ) : (
              <Btn
                onClick={() => {
                  setFormOpen(true);
                }}
              >
                + תיקון חדש
              </Btn>
            )
          }
        />
      ) : (
        <>
          {/* ─── תצוגת טבלה לדסקטופ (md ומעלה) ─────────────────────────────── */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-cz-line-soft bg-cz-bg/70 text-xs font-extrabold text-cz-mut">
                  <th className="px-4 py-3 text-start">מכשיר / דגם</th>
                  <th className="px-3 py-3 text-start">מס׳ סידורי</th>
                  <th className="px-3 py-3 text-start">מה התקלה</th>
                  <th className="px-3 py-3 text-start">מה תוקן</th>
                  <th className="px-3 py-3 text-start">למה מתעכב</th>
                  <th className="px-3 py-3 text-start">סטטוס</th>
                  <th className="px-4 py-3 text-end">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cz-line-soft">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={`transition-colors hover:bg-cz-bg/50 ${
                      r.delayReason?.trim() && r.status !== "completed" ? "bg-amber-50/30" : ""
                    }`}
                  >
                    {/* סוג מכשיר + דגם */}
                    <td className="px-4 py-3.5 align-top">
                      <div className="flex items-center gap-2">
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-cz-sand text-base"
                          title={REPAIR_DEVICE_LABELS[r.deviceType]}
                        >
                          {r.deviceType === "bicycle" ? "🚲" : "🛴"}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link href={`/repairs/${r.id}`} className="num text-xs font-extrabold text-cz-red hover:underline">
                              {r.repairNumber}
                            </Link>
                            <Badge tone="gray">{REPAIR_DEVICE_LABELS[r.deviceType]}</Badge>
                          </div>
                          <Link
                            href={`/models/${r.modelId}`}
                            className="mt-0.5 block font-display font-extrabold text-cz-ink hover:text-cz-red"
                          >
                            {r.modelName}
                          </Link>
                          {(r.customerName || r.technician) && (
                            <div className="mt-0.5 text-[11px] text-cz-fog">
                              {[r.customerName, r.technician && `מטפל: ${r.technician}`]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* מספר סידורי */}
                    <td className="px-3 py-3.5 align-top">
                      {r.serialNumber ? (
                        <span
                          dir="ltr"
                          className="num inline-block rounded-lg bg-cz-sand px-2.5 py-1 text-xs font-bold text-cz-ink"
                        >
                          {r.serialNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-cz-fog">—</span>
                      )}
                      <div className="mt-1 text-[11px] text-cz-fog">{fmtDate(r.createdAt)}</div>
                    </td>

                    {/* מה התקלה */}
                    <td className="max-w-xs px-3 py-3.5 align-top">
                      <div className="font-semibold leading-snug text-cz-ink">
                        {r.faultDescription}
                      </div>
                      {r.usedPartNames.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {r.usedPartNames.map((p, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-cz-sand px-2 py-0.5 text-[11px] font-bold text-cz-mut"
                            >
                              🔧 {p}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* מה תוקן */}
                    <td className="max-w-xs px-3 py-3.5 align-top">
                      {r.fixDescription ? (
                        <div className="leading-snug text-cz-green font-semibold">
                          {r.fixDescription}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => router.push(`/repairs/${r.id}`)}
                          className="text-xs font-bold text-cz-fog underline decoration-dashed hover:text-cz-ink"
                        >
                          + הוסף מה תוקן
                        </button>
                      )}
                    </td>

                    {/* למה מתעכב */}
                    <td className="max-w-52 px-3 py-3.5 align-top">
                      {r.delayReason?.trim() ? (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900">
                          ⏳ {r.delayReason}
                        </div>
                      ) : (
                        <span className="text-xs text-cz-fog">ללא עיכוב</span>
                      )}
                    </td>

                    {/* סטטוס בלחיצה מהירה */}
                    <td className="px-3 py-3.5 align-top">
                      <select
                        aria-label={`סטטוס ${r.repairNumber}`}
                        value={r.status}
                        onChange={(e) => quickStatusChange(r, e.target.value as RepairStatus)}
                        className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-xs font-extrabold transition-colors focus:ring-2 focus:ring-cz-red ${
                          r.status === "waiting"
                            ? "bg-cz-red-soft text-cz-red"
                            : r.status === "inProgress"
                            ? "bg-sky-100 text-sky-800"
                            : "bg-cz-green-soft text-cz-green"
                        }`}
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s} className="bg-white text-cz-ink">
                            {REPAIR_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      {r.completedAt && r.status === "completed" && (
                        <div className="mt-1 text-[11px] text-cz-green">
                          הסתיים {fmtDate(r.completedAt)}
                        </div>
                      )}
                    </td>

                    {/* פעולות */}
                    <td className="px-4 py-3.5 align-top text-end">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => router.push(`/repairs/${r.id}`)}
                          className="rounded-full px-3 py-1.5 text-xs font-bold text-cz-ink hover:bg-cz-sand"
                        >
                          עריכה
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryRepair(r)}
                          className="rounded-full px-2.5 py-1.5 text-xs font-bold text-cz-mut hover:bg-cz-sand"
                          title="היסטוריית זמנים"
                        >
                          🕒
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setDeleting(r)}
                            className="rounded-full px-2.5 py-1.5 text-xs font-bold text-cz-fog hover:bg-cz-red-soft hover:text-cz-red"
                            title="מחיקת תיקון"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ─── תצוגת כרטיסים מותאמת למובייל (עד md) ───────────────────────── */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => (
              <div
                key={r.id}
                className={`card p-4 ${
                  r.delayReason?.trim() && r.status !== "completed"
                    ? "border-amber-300 bg-amber-50/20"
                    : ""
                }`}
              >
                {/* כותרת כרטיס: סוג מכשיר + מספר + סטטוס */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-cz-sand text-xl">
                      {r.deviceType === "bicycle" ? "🚲" : "🛴"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/repairs/${r.id}`} className="num text-xs font-extrabold text-cz-red hover:underline">
                          {r.repairNumber}
                        </Link>
                        <Badge tone="gray">{REPAIR_DEVICE_LABELS[r.deviceType]}</Badge>
                        {r.serialNumber && (
                          <span
                            dir="ltr"
                            className="num rounded-md bg-cz-sand px-2 py-0.5 text-[11px] font-bold"
                          >
                            {r.serialNumber}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/models/${r.modelId}`}
                        className="mt-0.5 block truncate font-display text-base font-extrabold hover:text-cz-red"
                      >
                        {r.modelName}
                      </Link>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONES[r.status]}>{REPAIR_STATUS_LABELS[r.status]}</Badge>
                </div>

                {/* פירוט שדות בטבלה אנכית נוחה לנייד */}
                <div className="mt-3 space-y-2 rounded-2xl bg-cz-bg p-3 text-sm">
                  <div>
                    <span className="text-xs font-bold text-cz-mut">מה התקלה: </span>
                    <span className="font-semibold text-cz-ink">{r.faultDescription}</span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-cz-mut">מה תוקן: </span>
                    {r.fixDescription ? (
                      <span className="font-semibold text-cz-green">{r.fixDescription}</span>
                    ) : (
                      <span className="text-xs text-cz-fog">טרם עודכן</span>
                    )}
                  </div>
                  {r.delayReason?.trim() && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
                      ⏳ למה מתעכב: {r.delayReason}
                    </div>
                  )}
                  {r.usedPartNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.usedPartNames.map((p, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-cz-mut"
                        >
                          🔧 {p}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* החלפת סטטוס בלחיצת כפתור בנייד */}
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-bold text-cz-fog">שינוי סטטוס מהיר:</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {STATUS_ORDER.map((s) => {
                      const active = r.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => quickStatusChange(r, s)}
                          className={`min-h-9 rounded-full px-2 text-xs font-extrabold transition-all ${
                            active
                              ? s === "waiting"
                                ? "bg-cz-red text-white shadow-sm"
                                : s === "inProgress"
                                ? "bg-sky-600 text-white shadow-sm"
                                : "bg-cz-green text-white shadow-sm"
                              : "bg-cz-sand/80 text-cz-mut hover:bg-cz-sand"
                          }`}
                        >
                          {REPAIR_STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* שורת תחתית: תאריך + פעולות */}
                <div className="mt-3 flex items-center justify-between border-t border-cz-line-soft pt-2.5 text-xs text-cz-fog">
                  <span>
                    {fmtDate(r.createdAt)}
                    {r.customerName ? ` · ${r.customerName}` : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/repairs/${r.id}`)}
                      className="rounded-full bg-cz-sand px-3 py-1.5 font-bold text-cz-ink"
                    >
                      עריכה
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryRepair(r)}
                      className="rounded-full px-2.5 py-1.5 font-bold text-cz-mut hover:bg-cz-sand"
                      aria-label="היסטוריה"
                    >
                      🕒
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setDeleting(r)}
                        className="rounded-full px-2.5 py-1.5 font-bold text-cz-fog hover:bg-cz-red-soft hover:text-cz-red"
                        aria-label="מחיקה"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* מודל הוספה / עריכת תיקון (כולל הוספת דגם חדש במקום!) */}
      <RepairFormModal
        open={formOpen}
        repair={null}
        models={models}
        parts={parts}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false);
          await load();
        }}
      />

      {/* מודל היסטוריית זמנים של התיקון */}
      <Modal
        open={!!historyRepair}
        onClose={() => setHistoryRepair(null)}
        title={historyRepair ? `תיעוד זמנים — ${historyRepair.repairNumber} (${historyRepair.modelName})` : ""}
      >
        {historyRepair && (
          <div>
            {(!historyRepair.history || historyRepair.history.length === 0) ? (
              <p className="py-6 text-center text-sm text-cz-mut">אין היסטוריה מתועדת</p>
            ) : (
              <ol className="relative space-y-4 border-s-2 border-cz-line ps-5">
                {[...historyRepair.history].reverse().map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -start-[27px] top-1 size-3 rounded-full bg-cz-red" />
                    <div className="text-sm font-bold">
                      {h.action}
                      {h.from && <span className="text-cz-mut"> ({h.from}</span>}
                      {h.to && (
                        <span className="text-cz-ink">
                          {h.from ? ` ← ${h.to})` : ` → ${h.to}`}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-cz-fog">
                      {h.user} · {fmtDateTime(h.at)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Modal>

      {/* מודל אישור מחיקה */}
      <ConfirmModal
        open={!!deleting}
        title="מחיקת כרטיס תיקון"
        message={
          deleting
            ? `למחוק את התיקון ${deleting.repairNumber} (${deleting.modelName}${
                deleting.serialNumber ? ` · סידורי ${deleting.serialNumber}` : ""
              }) לצמיתות?`
            : ""
        }
        confirmLabel="מחיקה לצמיתות"
        danger
        busy={busy}
        onConfirm={deleteRepair}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

export default function RepairsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Spinner className="size-8 text-cz-red" />
        </div>
      }
    >
      <RepairsInner />
    </Suspense>
  );
}
