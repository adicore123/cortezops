import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, updateById, getById } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import { REPAIR_STATUS_LABELS, REPAIR_DEVICE_LABELS } from "@/lib/types";
import { findDuplicateModel, isRepairDeviceType, makePendingRepairModel, modelMatchesDevice } from "@/lib/repair-model";
import type { NewRepairModel } from "@/lib/repair-model";
import type { Repair, RepairDeviceType, RepairStatus, ToolModel, Part } from "@/lib/types";

export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const repair = await getById<Repair>("repairs", id);
  if (!repair) return bad("תיקון לא נמצא", 404);

  const [models, parts] = await Promise.all([
    readCollection<ToolModel>("models"),
    readCollection<Part>("parts"),
  ]);
  const model = models.find((m) => m.id === repair.modelId) ?? null;

  return json({
    repair: {
      ...repair,
      modelName: model?.commercialName ?? repair.modelName ?? "—",
    },
    model,
    parts: parts.map(({ id, name, sku, compatibleModelIds }) => ({ id, name, sku, compatibleModelIds })),
  });
});

export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const existing = await getById<Repair>("repairs", id);
  if (!existing) return bad("תיקון לא נמצא", 404);

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

  if (data.deviceType !== undefined && !isRepairDeviceType(data.deviceType)) return bad("סוג מכשיר לא תקין");
  if (data.status !== undefined && !["waiting", "inProgress", "completed"].includes(data.status)) return bad("סטטוס תיקון לא תקין");
  if (data.faultDescription !== undefined && !data.faultDescription.trim()) return bad("נדרש תיאור התקלה");
  const effectiveStatus = data.status ?? existing.status;
  const effectiveFix = data.fixDescription !== undefined ? data.fixDescription.trim() : existing.fixDescription?.trim();
  if (effectiveStatus === "completed" && !effectiveFix) return bad("יש לתאר מה תוקן לפני סיום התיקון");

  const effectiveDevice = data.deviceType ?? existing.deviceType;
  const now = new Date().toISOString();
  const models = await readCollection<ToolModel>("models");
  let createdModel: ToolModel | null = null;
  let targetModelId = data.modelId ?? existing.modelId;
  let resolvedModelName: string | undefined;
  if (data.newModel) {
    if (!data.newModel.commercialName?.trim()) return bad("נדרש שם לדגם החדש");
    if (data.newModel.deviceType && data.newModel.deviceType !== effectiveDevice) return bad("סוג הדגם אינו תואם למכשיר");
    if (findDuplicateModel(models, data.newModel.commercialName, effectiveDevice)) return bad("דגם בשם זה כבר קיים לסוג המכשיר שנבחר", 409);
    createdModel = makePendingRepairModel(data.newModel, effectiveDevice, now);
    targetModelId = createdModel.id;
    resolvedModelName = createdModel.commercialName;
  } else if ((data.modelId && data.modelId !== existing.modelId) || (data.deviceType && data.deviceType !== existing.deviceType)) {
    const found = models.find((m) => m.id === targetModelId);
    if (!found) return bad("דגם לא נמצא", 404);
    if (!modelMatchesDevice(found, effectiveDevice)) return bad("הדגם אינו תואם לסוג המכשיר");
    resolvedModelName = found.commercialName;
  }

  if (createdModel) await writeCollection<ToolModel>("models", (items) => [createdModel!, ...items]);
  let updated: Repair | null;
  try {
    updated = await updateById<Repair>("repairs", id, (r) => {
    const next: Repair = { ...r, updatedAt: now };
    const history = [...(r.history ?? [])];

    if (data.deviceType && data.deviceType !== r.deviceType) {
      history.push({
        at: now,
        user: res.user.name,
        action: "שינוי סוג מכשיר",
        from: REPAIR_DEVICE_LABELS[r.deviceType],
        to: REPAIR_DEVICE_LABELS[data.deviceType],
      });
      next.deviceType = data.deviceType;
    }

    if (targetModelId !== r.modelId) {
      history.push({
        at: now,
        user: res.user.name,
        action: "שינוי דגם",
        from: r.modelName,
        to: resolvedModelName,
      });
      next.modelId = targetModelId;
      if (resolvedModelName) next.modelName = resolvedModelName;
    }

    if (data.serialNumber !== undefined && data.serialNumber.trim() !== r.serialNumber) {
      next.serialNumber = data.serialNumber.trim();
    }

    if (data.faultDescription !== undefined && data.faultDescription.trim()) {
      next.faultDescription = data.faultDescription.trim();
    }

    if (data.fixDescription !== undefined && data.fixDescription.trim() !== (r.fixDescription ?? "")) {
      const prev = r.fixDescription ?? "";
      next.fixDescription = data.fixDescription.trim();
      if (!prev && next.fixDescription) {
        history.push({
          at: now,
          user: res.user.name,
          action: "תועד מה תוקן",
          to: next.fixDescription,
        });
      }
    }

    if (data.delayReason !== undefined && data.delayReason.trim() !== (r.delayReason ?? "")) {
      const prev = r.delayReason ?? "";
      const nextDelay = data.delayReason.trim();
      next.delayReason = nextDelay;
      if (nextDelay && nextDelay !== prev) {
        history.push({
          at: now,
          user: res.user.name,
          action: "עדכון סיבת עיכוב",
          to: nextDelay,
        });
      } else if (!nextDelay && prev) {
        history.push({
          at: now,
          user: res.user.name,
          action: "הוסר עיכוב",
          from: prev,
        });
      }
    }

    if (data.status && data.status !== r.status) {
      history.push({
        at: now,
        user: res.user.name,
        action: "שינוי סטטוס",
        from: REPAIR_STATUS_LABELS[r.status],
        to: REPAIR_STATUS_LABELS[data.status],
      });
      next.status = data.status;
      if (data.status === "completed") {
        next.completedAt = now;
      } else {
        next.completedAt = undefined;
      }
    }

    if (data.technician !== undefined && data.technician.trim() !== (r.technician ?? "")) {
      next.technician = data.technician.trim();
      history.push({
        at: now,
        user: res.user.name,
        action: "שינוי מטפל",
        to: next.technician || "ללא",
      });
    }

    if (data.customerName !== undefined) next.customerName = data.customerName.trim();
    if (data.customerPhone !== undefined) next.customerPhone = data.customerPhone.trim();
    if (data.usedPartIds !== undefined) next.usedPartIds = data.usedPartIds;
    if (data.notes !== undefined) next.notes = data.notes.trim();

    next.history = history;
    return next;
    });
  } catch (error) {
    if (createdModel) await writeCollection<ToolModel>("models", (items) => items.filter((m) => m.id !== createdModel!.id));
    throw error;
  }

  if (!updated) {
    if (createdModel) await writeCollection<ToolModel>("models", (items) => items.filter((m) => m.id !== createdModel!.id));
    return bad("תיקון לא נמצא", 404);
  }
  return json({ repair: updated, createdModel });
});

export const DELETE = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;
  if (res.user.role === "agent") return bad("אין הרשאה למחיקת תיקון", 403);

  const { id } = await ctx.params;
  const existing = await getById<Repair>("repairs", id);
  if (!existing) return bad("תיקון לא נמצא", 404);

  await writeCollection<Repair>("repairs", (items) => items.filter((r) => r.id !== id));
  return json({ deleted: true, id });
});
