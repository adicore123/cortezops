import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId, nextNumber } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import { REPAIR_STATUS_LABELS } from "@/lib/types";
import { findDuplicateModel, isRepairDeviceType, makePendingRepairModel, modelMatchesDevice } from "@/lib/repair-model";
import type { NewRepairModel } from "@/lib/repair-model";
import type { Repair, RepairDeviceType, RepairStatus, ToolModel, Part } from "@/lib/types";

/** רשימת תיקונים — כולל שם דגם מעודכן ושמות חלפים. */
export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;

  const [repairs, models, parts] = await Promise.all([
    readCollection<Repair>("repairs"),
    readCollection<ToolModel>("models"),
    readCollection<Part>("parts"),
  ]);

  const modelById = new Map(models.map((m) => [m.id, m]));
  const partById = new Map(parts.map((p) => [p.id, p]));

  const rows = repairs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const m = modelById.get(r.modelId);
      return {
        ...r,
        modelName: m?.commercialName ?? r.modelName ?? "—",
        modelCode: m?.manufacturerCode ?? "",
        usedPartNames: (r.usedPartIds ?? [])
          .map((id) => partById.get(id)?.name)
          .filter((x): x is string => Boolean(x)),
      };
    });

  return json({
    repairs: rows,
    parts: parts.map(({ id, name, sku, compatibleModelIds }) => ({ id, name, sku, compatibleModelIds })),
    canManage: res.user.role !== "agent",
  });
});

/** פתיחת תיקון חדש — תומך גם ביצירת דגם חדש במקום ושיוכו לאופניים/קורקינט. */
export const POST = route(async (req: NextRequest) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;

  const data = await body<{
    deviceType?: RepairDeviceType;
    modelId?: string;
    newModel?: NewRepairModel;
    serialNumber?: string;
    faultDescription?: string;
    fixDescription?: string;
    delayReason?: string;
    status?: RepairStatus;
    technician?: string;
    customerName?: string;
    customerPhone?: string;
    usedPartIds?: string[];
    notes?: string;
  }>(req);

  if (!isRepairDeviceType(data.deviceType)) return bad("יש לבחור סוג מכשיר");
  const deviceType: RepairDeviceType = data.deviceType;

  if (!data.faultDescription?.trim()) {
    return bad("נדרש תיאור התקלה");
  }
  if (data.status && !["waiting", "inProgress", "completed"].includes(data.status)) {
    return bad("סטטוס תיקון לא תקין");
  }
  const status: RepairStatus = data.status ?? "waiting";
  if (status === "completed" && !data.fixDescription?.trim()) {
    return bad("יש לתאר מה תוקן לפני סיום התיקון");
  }

  const now = new Date().toISOString();
  let modelId = data.modelId?.trim() ?? "";
  let modelName = "";
  let createdModel: ToolModel | null = null;

  const models = await readCollection<ToolModel>("models");

  if (data.newModel) {
    if (!data.newModel.commercialName?.trim()) return bad("נדרש שם לדגם החדש");
    if (data.newModel.deviceType && data.newModel.deviceType !== deviceType) return bad("סוג הדגם אינו תואם למכשיר");
    if (findDuplicateModel(models, data.newModel.commercialName, deviceType)) return bad("דגם בשם זה כבר קיים לסוג המכשיר שנבחר", 409);
    createdModel = makePendingRepairModel(data.newModel, deviceType, now);
    modelId = createdModel.id;
    modelName = createdModel.commercialName;
  } else if (modelId) {
    const found = models.find((m) => m.id === modelId);
    if (!found) return bad("הדגם שנבחר לא נמצא", 404);
    if (!modelMatchesDevice(found, deviceType)) return bad("הדגם אינו תואם לסוג המכשיר");
    modelName = found.commercialName;
  } else {
    return bad("יש לבחור דגם או להוסיף דגם חדש");
  }

  const repairNumber = await nextNumber("repairs", "RP");
  const repair: Repair = {
    id: newId(),
    repairNumber,
    deviceType,
    modelId,
    modelName,
    serialNumber: data.serialNumber?.trim() ?? "",
    faultDescription: data.faultDescription.trim(),
    fixDescription: data.fixDescription?.trim() ?? "",
    delayReason: data.delayReason?.trim() ?? "",
    status,
    technician: data.technician?.trim() || res.user.name,
    customerName: data.customerName?.trim() ?? "",
    customerPhone: data.customerPhone?.trim() ?? "",
    usedPartIds: data.usedPartIds ?? [],
    notes: data.notes?.trim() ?? "",
    completedAt: status === "completed" ? now : undefined,
    history: [
      {
        at: now,
        user: res.user.name,
        action: "נפתח כרטיס תיקון",
        to: REPAIR_STATUS_LABELS[status],
      },
    ],
    createdBy: res.user.name,
    createdAt: now,
    updatedAt: now,
  };

  if (createdModel) await writeCollection<ToolModel>("models", (items) => [createdModel!, ...items]);
  try {
    await writeCollection<Repair>("repairs", (items) => [repair, ...items]);
  } catch (error) {
    if (createdModel) await writeCollection<ToolModel>("models", (items) => items.filter((m) => m.id !== createdModel!.id));
    throw error;
  }

  return json({ repair, createdModel }, 201);
});
