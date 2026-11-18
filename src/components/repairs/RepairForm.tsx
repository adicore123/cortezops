"use client";

import { useEffect, useMemo, useState } from "react";
import { apiSend } from "@/lib/client";
import { Btn, Field, Modal } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import { REPAIR_DEVICE_LABELS, REPAIR_DEVICE_CATEGORY, REPAIR_STATUS_LABELS } from "@/lib/types";
import type { Repair, RepairDeviceType, RepairStatus, ToolModel, Part } from "@/lib/types";

export type RepairRow = Repair & { modelName: string; modelCode?: string; usedPartNames: string[] };
export type RepairPartOption = Pick<Part, "id" | "name" | "sku" | "compatibleModelIds">;
const STATUS_ORDER: RepairStatus[] = ["waiting", "inProgress", "completed"];
function matchModelToDevice(model: ToolModel, type: RepairDeviceType): boolean {
  return !model.archived && model.category === REPAIR_DEVICE_CATEGORY[type];
}
// ─── מודל הוספה / עריכה של תיקון + יצירת דגם חדש במקום ──────────────────────

export function RepairFormModal({
  open,
  repair,
  models,
  parts,
  onClose,
  onSaved,
  asPage = false,
}: {
  open: boolean;
  repair: RepairRow | null;
  models: ToolModel[];
  parts: RepairPartOption[];
  onClose: () => void;
  onSaved: () => void;
  asPage?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const [deviceType, setDeviceType] = useState<RepairDeviceType>("bicycle");
  const [modelId, setModelId] = useState("");
  const [addingNewModel, setAddingNewModel] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelCode, setNewModelCode] = useState("");

  const [serialNumber, setSerialNumber] = useState("");
  const [faultDescription, setFaultDescription] = useState("");
  const [fixDescription, setFixDescription] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [status, setStatus] = useState<RepairStatus>("waiting");
  const [technician, setTechnician] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [usedPartIds, setUsedPartIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");

  // דגמים מסוננים לפי סוג המכשיר שנבחר (אופניים / קורקינט)
  const matchingModels = useMemo(
    () => models.filter((m) => matchModelToDevice(m, deviceType)),
    [models, deviceType]
  );

  useEffect(() => {
    if (!open) return;
    if (repair) {
      setDeviceType(repair.deviceType);
      setModelId(repair.modelId);
      setAddingNewModel(false);
      setNewModelName("");
      setNewModelCode("");
      setSerialNumber(repair.serialNumber ?? "");
      setFaultDescription(repair.faultDescription ?? "");
      setFixDescription(repair.fixDescription ?? "");
      setDelayReason(repair.delayReason ?? "");
      setStatus(repair.status);
      setTechnician(repair.technician ?? "");
      setCustomerName(repair.customerName ?? "");
      setCustomerPhone(repair.customerPhone ?? "");
      setUsedPartIds(repair.usedPartIds ?? []);
      setNotes(repair.notes ?? "");
    } else {
      const defaultType: RepairDeviceType = "bicycle";
      setDeviceType(defaultType);
      setModelId("");
      setAddingNewModel(!models.some((m) => matchModelToDevice(m, defaultType)));
      setNewModelName("");
      setNewModelCode("");
      setSerialNumber("");
      setFaultDescription("");
      setFixDescription("");
      setDelayReason("");
      setStatus("waiting");
      setTechnician("");
      setCustomerName("");
      setCustomerPhone("");
      setUsedPartIds([]);
      setNotes("");
    }
    setErr("");
  }, [open, repair, models]);

  function handleSwitchDeviceType(nextType: RepairDeviceType) {
    setDeviceType(nextType);
    if (!addingNewModel) {
      const currentStillMatches = models.some(
        (m) => m.id === modelId && matchModelToDevice(m, nextType)
      );
      if (!currentStillMatches) {
        setModelId("");
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");

    if (!faultDescription.trim()) {
      setErr("יש להזין מה התקלה");
      return;
    }

    if (addingNewModel) {
      if (!newModelName.trim()) {
        setErr("יש להזין את שם הדגם החדש");
        return;
      }
    } else if (!modelId) {
      setErr("יש לבחור דגם או ללחוץ על '+ דגם חדש'");
      return;
    }
    if (status === "completed" && !fixDescription.trim()) {
      setErr("יש לתאר מה תוקן לפני סיום התיקון");
      return;
    }

    setBusy(true);
    try {
      if (repair) {
        await apiSend(`/api/repairs/${repair.id}`, "PATCH", {
          deviceType,
          modelId: addingNewModel ? undefined : modelId,
          newModel: addingNewModel
            ? { commercialName: newModelName.trim(), manufacturerCode: newModelCode.trim(), deviceType }
            : undefined,
          serialNumber,
          faultDescription,
          fixDescription,
          delayReason,
          status,
          technician,
          customerName,
          customerPhone,
          usedPartIds,
          notes,
        });
        toast.push("success", `התיקון ${repair.repairNumber} עודכן`);
      } else {
        const res = await apiSend<{ repair: Repair; createdModel?: ToolModel | null }>(
          "/api/repairs",
          "POST",
          {
            deviceType,
            modelId: addingNewModel ? undefined : modelId,
            newModel: addingNewModel
              ? {
                  commercialName: newModelName.trim(),
                  manufacturerCode: newModelCode.trim(),
                  deviceType,
                }
              : undefined,
            serialNumber,
            faultDescription,
            fixDescription,
            delayReason,
            status,
            technician,
            customerName,
            customerPhone,
            usedPartIds,
            notes,
          }
        );
        if (res.createdModel) {
          toast.push(
            "success",
            `נוסף דגם חדש "${res.createdModel.commercialName}" (${REPAIR_DEVICE_LABELS[deviceType]}) ונפתח תיקון ${res.repair.repairNumber}`
          );
        } else {
          toast.push("success", `נפתח כרטיס תיקון ${res.repair.repairNumber}`);
        }
      }
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  // חלפים תואמים לדגם שנבחר (או כל החלפים אם מדובר בדגם חדש)
  const suggestedParts = useMemo(() => {
    if (addingNewModel || !modelId) return parts;
    const compat = parts.filter((p) => p.compatibleModelIds.includes(modelId));
    return compat.length > 0 ? compat : parts;
  }, [parts, modelId, addingNewModel]);

  const form = (
      <form onSubmit={submit} className="space-y-4">
        {err && (
          <div className="rounded-xl bg-cz-red-soft px-4 py-2.5 text-sm font-bold text-cz-red">
            {err}
          </div>
        )}

        {/* 1. סוג מכשיר בלחיצת כפתור: אופניים / קורקינט */}
        <Field label="סוג מכשיר (בלחיצת כפתור)">
          <div className="grid grid-cols-2 gap-2.5">
            {(["bicycle", "scooter"] as RepairDeviceType[]).map((dt) => {
              const active = deviceType === dt;
              return (
                <button
                  key={dt}
                  type="button"
                  onClick={() => handleSwitchDeviceType(dt)}
                  className={`flex min-h-13 items-center justify-center gap-2.5 rounded-2xl border-2 px-4 text-base font-extrabold transition-all ${
                    active
                      ? "border-cz-red bg-cz-red text-white shadow-[0_6px_16px_rgba(200,10,4,.22)]"
                      : "border-cz-line bg-cz-bg text-cz-ink hover:border-cz-ink"
                  }`}
                >
                  <span className="text-xl">{dt === "bicycle" ? "🚲" : "🛴"}</span>
                  <span>{REPAIR_DEVICE_LABELS[dt]}</span>
                </button>
              );
            })}
          </div>
        </Field>

        {/* 2. בחירת דגם או הוספת דגם חדש ושיוכו לסוג המכשיר */}
        <div className="rounded-2xl border border-cz-line-soft bg-cz-bg/60 p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="text-xs font-extrabold text-cz-ink">
              דגם ({REPAIR_DEVICE_CATEGORY[deviceType]})
            </label>
            <button
              type="button"
              onClick={() => setAddingNewModel((v) => !v)}
              className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-cz-red shadow-xs hover:bg-cz-red hover:text-white transition-colors"
            >
              {addingNewModel ? "← בחירה מדגמים קיימים" : "+ הוספת דגם חדש למאגר"}
            </button>
          </div>

          {!addingNewModel ? (
            <select
              className="field"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
            >
              <option value="">בחרו דגם…</option>
              {matchingModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.commercialName} {m.manufacturerCode ? `(${m.manufacturerCode})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={`שם הדגם החדש (ישויך ל${REPAIR_DEVICE_CATEGORY[deviceType]})`}
              >
                <input
                  className="field"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder={
                    deviceType === "bicycle" ? "למשל: CORTEZ PRO 2027" : "למשל: CORTEZ SCOOT X"
                  }
                  autoFocus
                />
              </Field>
              <Field label="קוד דגם יצרן (אופציונלי)">
                <input
                  className="field"
                  dir="ltr"
                  value={newModelCode}
                  onChange={(e) => setNewModelCode(e.target.value)}
                  placeholder="CZ-PRO-27"
                />
              </Field>
            </div>
          )}
        </div>

        {/* 3. מספר סידורי + סטטוס בלחיצת כפתור */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מספר סידורי / מספר שלדה">
            <input
              className="field num"
              dir="ltr"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="SN-10293 / FR-9921"
            />
          </Field>

          <Field label="סטטוס התיקון">
            <div className="grid grid-cols-3 gap-1.5">
              {STATUS_ORDER.map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`min-h-11 rounded-xl px-2 text-xs font-extrabold transition-all ${
                      active
                        ? s === "waiting"
                          ? "bg-cz-red text-white shadow-sm"
                          : s === "inProgress"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "bg-cz-green text-white shadow-sm"
                        : "border border-cz-line bg-white text-cz-mut hover:text-cz-ink"
                    }`}
                  >
                    {REPAIR_STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>

        {/* 4. מה התקלה + מה תוקן */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="מה התקלה *">
            <textarea
              className="field min-h-22"
              value={faultDescription}
              onChange={(e) => setFaultDescription(e.target.value)}
              placeholder="תיאור התקלה כפי שהתקבלה…"
              required
            />
          </Field>
          <Field label="מה תוקן">
            <textarea
              className="field min-h-22"
              value={fixDescription}
              onChange={(e) => setFixDescription(e.target.value)}
              placeholder="פירוט התיקון שבוצע / חלקים שהוחלפו…"
            />
          </Field>
        </div>

        {/* 5. למה זה מתעכב (מודגש בכתום/צהוב) */}
        <Field
          label="למה זה מתעכב (אם יש עיכוב)"
          hint="למשל: ממתין לחלק מהיבואן, ממתין לאישור לקוח, בדיקת מעבדה נוספת"
        >
          <input
            className="field border-amber-300 bg-amber-50/40 focus:border-amber-600"
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            placeholder="השאירו ריק אם אין עיכוב…"
          />
        </Field>

        {/* 6. הגדלת ראש: שיוך חלפים מהמלאי + פרטי לקוח/סוכן ומטפל */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="שם לקוח / סוכן / חנות">
            <input
              className="field"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="שם הפונה"
            />
          </Field>
          <Field label="טלפון ליצירת קשר">
            <input
              className="field"
              dir="ltr"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="050-0000000"
            />
          </Field>
          <Field label="טכנאי / אחראי מטפל">
            <input
              className="field"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              placeholder="שם המטפל"
            />
          </Field>
        </div>

        {suggestedParts.length > 0 && (
          <Field label="חלפים שהוחלפו / נדרשים לתיקון (אופציונלי)">
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-2xl border border-cz-line bg-white p-2.5">
              {suggestedParts.map((p) => {
                const active = usedPartIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setUsedPartIds((ids) =>
                        active ? ids.filter((x) => x !== p.id) : [...ids, p.id]
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                      active
                        ? "bg-cz-ink text-white"
                        : "bg-cz-sand text-cz-mut hover:bg-cz-line"
                    }`}
                  >
                    {p.name} ({p.sku})
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="הערות נוספות">
          <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 border-t border-cz-line-soft pt-3">
          <Btn variant="ghost" type="button" onClick={onClose}>
            ביטול
          </Btn>
          <Btn type="submit" loading={busy}>
            {repair ? "שמירת שינויים" : "פתיחת תיקון"}
          </Btn>
        </div>
      </form>
  );
  if (asPage) return <div className="card p-4 sm:p-6">{form}</div>;
  return (
    <Modal open={open} onClose={onClose} title={repair ? `עריכת תיקון — ${repair.repairNumber}` : "פתיחת כרטיס תיקון חדש"} wide>
      {form}
    </Modal>
  );
}
