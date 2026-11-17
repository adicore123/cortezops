"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, apiSend } from "@/lib/client";
import { Badge, Btn, EmptyState, Field, Modal, PageHeader, Spinner, fmtDateTime, fmtMoney } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import FileUploader from "@/components/FileUploader";
import { MOVEMENT_LABELS } from "@/lib/types";
import type { Part, PartMovement, StoredFile, ToolModel, MovementType } from "@/lib/types";

type PartRow = Part & { compatibleModels: string[] };

function PartsInner() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<PartRow[] | null>(null);
  const [models, setModels] = useState<ToolModel[]>([]);
  const [showCosts, setShowCosts] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [editPart, setEditPart] = useState<Part | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [movePart, setMovePart] = useState<PartRow | null>(null);
  const [historyPart, setHistoryPart] = useState<PartRow | null>(null);
  const [movements, setMovements] = useState<PartMovement[] | null>(null);

  const load = useCallback(async () => {
    try {
      const [partsData, settingsData, modelsData] = await Promise.all([
        apiGet<{ parts: PartRow[]; showCosts: boolean }>("/api/parts"),
        apiGet<{ settings: { partCategories: string[] } }>("/api/settings"),
        apiGet<{ models: ToolModel[] }>("/api/models"),
      ]);
      setRows(partsData.parts);
      setShowCosts(partsData.showCosts);
      setCategories(settingsData.settings.partCategories);
      setModels(modelsData.models.filter((m) => !m.archived));
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "טעינת המלאי נכשלה");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const manufacturers = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.manufacturer).filter(Boolean))),
    [rows]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((p) => {
      if (category && p.category !== category) return false;
      if (manufacturerFilter && p.manufacturer !== manufacturerFilter) return false;
      if (modelFilter && !p.compatibleModels.includes(modelFilter)) return false;
      if (!needle) return true;
      return [p.sku, p.name, p.partModel ?? ""].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, category, modelFilter, manufacturerFilter]);

  async function loadHistory(part: PartRow) {
    setHistoryPart(part);
    setMovements(null);
    try {
      const data = await apiGet<{ movements: PartMovement[] }>(`/api/parts/${part.id}/movements`);
      setMovements(data.movements);
    } catch {
      setMovements([]);
    }
  }

  if (!rows) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  return (
    <div>
      <PageHeader
        title="מלאי חלפים"
        subtitle={`${rows.length} חלקים · סוללות, מנועים, צגים, בקרים ועוד`}
        actions={<Btn onClick={() => { setEditPart(null); setEditOpen(true); }}>+ חלק חדש</Btn>}
      />

      {/* סינון */}
      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <input className="field pe-10" placeholder="חיפוש מק״ט או שם…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="pointer-events-none absolute inset-y-0 end-3 grid place-items-center text-cz-fog">🔍</span>
        </div>
        <select className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="field" value={manufacturerFilter} onChange={(e) => setManufacturerFilter(e.target.value)}>
          <option value="">כל היצרנים</option>
          {manufacturers.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="field" value={modelFilter} onChange={(e) => setModelFilter(e.target.value)}>
          <option value="">כל דגמי הכלי</option>
          {models.map((m) => <option key={m.id}>{m.commercialName}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="🔧" title="אין חלקים להצגה" hint="שנו את הסינון או הוסיפו חלק חדש" />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="card flex flex-wrap items-center gap-4 p-4">
              {p.imageFileIds.length > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${p.imageFileIds[0]}`} alt={p.name} className="size-16 shrink-0 rounded-2xl border border-cz-line-soft object-cover" />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-cz-sand text-2xl">🔧</div>
              )}
              <div className="min-w-40 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-extrabold">{p.name}</span>
                  <Badge tone="gray">{p.category}</Badge>
                  <span className="num text-xs text-cz-mut">{p.sku}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-cz-mut">
                  {p.partModel && <span>דגם: {p.partModel}</span>}
                  {p.manufacturer && <span>יצרן: {p.manufacturer}</span>}
                  {p.compatibleModels.length > 0 && <span>תואם: {p.compatibleModels.join(" · ")}</span>}
                </div>
              </div>
              <div className="text-center">
                <div className={`num text-2xl font-bold ${p.qty === 0 ? "text-cz-red" : p.qty <= 3 ? "text-amber-600" : "text-cz-green"}`}>{p.qty}</div>
                <div className="text-[11px] font-semibold text-cz-fog">במלאי</div>
              </div>
              <div className="text-center">
                <div className="num font-bold">{fmtMoney(p.shopPrice)}</div>
                <div className="text-[11px] font-semibold text-cz-fog">מחיר לחנות</div>
              </div>
              {showCosts && (
                <div className="text-center">
                  <div className="num font-bold text-cz-mut">{fmtMoney(p.importCost)}</div>
                  <div className="text-[11px] font-semibold text-cz-fog">עלות יבואן</div>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Btn size="sm" variant="primary" onClick={() => setMovePart(p)}>תנועת מלאי</Btn>
                <Btn size="sm" variant="outline" onClick={() => loadHistory(p)}>היסטוריה</Btn>
                <Btn size="sm" variant="ghost" onClick={() => { setEditPart(p); setEditOpen(true); }}>עריכה</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* חלק חדש / עריכה */}
      <PartEditModal
        open={editOpen}
        part={editPart}
        models={models}
        categories={categories}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); load(); }}
        showCosts={showCosts}
      />

      {/* תנועת מלאי */}
      {movePart && (
        <MovementModal
          part={movePart}
          onClose={() => setMovePart(null)}
          onDone={() => { setMovePart(null); load(); }}
        />
      )}

      {/* היסטוריית תנועות */}
      <Modal open={!!historyPart} onClose={() => setHistoryPart(null)} title={`היסטוריית תנועות — ${historyPart?.name ?? ""}`}>
        {movements === null ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : movements.length === 0 ? (
          <p className="text-center text-sm text-cz-mut">אין תנועות</p>
        ) : (
          <ul className="divide-y divide-cz-line-soft">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <span className={`font-bold ${m.type === "in" ? "text-cz-green" : m.type === "out" ? "text-cz-red" : "text-cz-mut"}`}>
                    {MOVEMENT_LABELS[m.type]}
                  </span>
                  {m.reason && <span className="text-cz-mut"> — {m.reason}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-cz-fog">
                  <span className="num font-bold text-cz-ink">{m.type === "adjust" ? `→ ${m.qty}` : m.type === "in" ? `+${m.qty}` : `−${m.qty}`}</span>
                  <span>{m.user} · {fmtDateTime(m.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  );
}

export default function PartsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>}>
      <PartsInner />
    </Suspense>
  );
}

// ─── מודל חלק ────────────────────────────────────────────────────────────────

function PartEditModal({
  open, part, models, categories, onClose, onSaved, showCosts,
}: {
  open: boolean;
  part: Part | null;
  models: ToolModel[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
  showCosts: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<StoredFile[]>([]);
  const [form, setForm] = useState({ sku: "", name: "", partModel: "", manufacturer: "", category: "", qty: "0", shopPrice: "", importCost: "", notes: "", compatibleModelIds: [] as string[] });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        sku: part?.sku ?? "",
        name: part?.name ?? "",
        partModel: part?.partModel ?? "",
        manufacturer: part?.manufacturer ?? "",
        category: part?.category ?? categories[0] ?? "",
        qty: String(part?.qty ?? 0),
        shopPrice: part?.shopPrice?.toString() ?? "",
        importCost: part?.importCost?.toString() ?? "",
        notes: part?.notes ?? "",
        compatibleModelIds: part?.compatibleModelIds ?? [],
      });
      setImages([]);
      setErr("");
    }
  }, [open, part, categories]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sku.trim() || !form.name.trim()) { setErr("נדרשים מק״ט ושם חלק"); return; }
    setBusy(true);
    try {
      const payload = {
        sku: form.sku,
        name: form.name,
        partModel: form.partModel,
        manufacturer: form.manufacturer,
        category: form.category,
        qty: Number(form.qty) || 0,
        shopPrice: form.shopPrice === "" ? undefined : Number(form.shopPrice),
        importCost: form.importCost === "" ? undefined : Number(form.importCost),
        notes: form.notes,
        compatibleModelIds: form.compatibleModelIds,
        imageFileIds: [...(part?.imageFileIds ?? []), ...images.map((i) => i.id)],
      };
      if (part) await apiSend(`/api/parts/${part.id}`, "PATCH", payload);
      else await apiSend("/api/parts", "POST", payload);
      toast.push("success", part ? "החלק עודכן" : "החלק נוסף למלאי");
      onSaved();
    } catch (e2) {
      toast.push("error", e2 instanceof Error ? e2.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={part ? `עריכת חלק — ${part.name}` : "חלק חדש"} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מק״ט" error={err}>
            <input className="field" dir="ltr" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="BAT-48V-13AH" />
          </Field>
          <Field label="שם חלק">
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="סוללה 48V/13Ah" />
          </Field>
          <Field label="דגם החלק">
            <input className="field" value={form.partModel} onChange={(e) => setForm({ ...form, partModel: e.target.value })} />
          </Field>
          <Field label="יצרן">
            <input className="field" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
          </Field>
          <Field label="קטגוריה">
            <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          {!part && (
            <Field label="כמות פתיחה">
              <input type="number" min="0" className="field" dir="ltr" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            </Field>
          )}
          <Field label="מחיר לחנות (₪)">
            <input type="number" min="0" step="0.01" className="field" dir="ltr" value={form.shopPrice} onChange={(e) => setForm({ ...form, shopPrice: e.target.value })} />
          </Field>
          {showCosts && (
            <Field label="עלות ליבואן (₪)">
              <input type="number" min="0" step="0.01" className="field" dir="ltr" value={form.importCost} onChange={(e) => setForm({ ...form, importCost: e.target.value })} />
            </Field>
          )}
        </div>

        <Field label="דגמי כלים תואמים" hint="חלק אחד יכול להתאים לכמה דגמים">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-cz-line bg-white p-3">
            {models.map((m) => {
              const active = form.compatibleModelIds.includes(m.id);
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() =>
                    setForm({
                      ...form,
                      compatibleModelIds: active
                        ? form.compatibleModelIds.filter((x) => x !== m.id)
                        : [...form.compatibleModelIds, m.id],
                    })
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-cz-red text-white" : "bg-cz-sand text-cz-mut hover:bg-cz-line"}`}
                >
                  {m.commercialName}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="תמונות החלק">
          <FileUploader compact onUploaded={(f) => setImages((arr) => [...arr, f])} onError={(m) => toast.push("error", m)} />
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f.id} src={`/api/files/${f.id}`} alt={f.originalName} className="size-16 rounded-xl border border-cz-line object-cover" />
              ))}
            </div>
          )}
        </Field>

        <Field label="הערות">
          <textarea className="field min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>

        <div className="flex justify-end gap-2">
          <Btn variant="ghost" type="button" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" loading={busy}>שמירה</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── תנועת מלאי ─────────────────────────────────────────────────────────────

function MovementModal({ part, onClose, onDone }: { part: PartRow; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [type, setType] = useState<MovementType>("in");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (type === "adjust" && !reason.trim()) {
      toast.push("error", "התאמת ספירה דורשת סיבה");
      return;
    }
    setBusy(true);
    try {
      await apiSend(`/api/parts/${part.id}/movements`, "POST", { type, qty: Number(qty), reason });
      toast.push("success", "התנועה נרשמה");
      onDone();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "רישום התנועה נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`תנועת מלאי — ${part.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-cz-bg px-4 py-3 text-sm">
          כמות נוכחית: <span className="num font-bold">{part.qty}</span>
        </div>
        <Field label="סוג תנועה">
          <div className="flex gap-2">
            {(["in", "out", "adjust"] as MovementType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`min-h-11 flex-1 rounded-full px-4 text-sm font-bold ${type === t ? "bg-cz-ink text-white" : "bg-cz-sand text-cz-mut"}`}
              >
                {MOVEMENT_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>
        <Field label={type === "adjust" ? "הכמות שנספרה בפועל" : "כמות"}>
          <input type="number" min="0" className="field" dir="ltr" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="סיבה" hint={type === "adjust" ? "חובה להתאמת ספירה" : "למשל: חלוקה למשווק, החלפה באחריות"}>
          <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" type="button" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" loading={busy}>רישום התנועה</Btn>
        </div>
      </form>
    </Modal>
  );
}
