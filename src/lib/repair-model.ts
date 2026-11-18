import { newId } from "./db/store";
import { REPAIR_DEVICE_CATEGORY } from "./types";
import type { RepairDeviceType, ToolModel } from "./types";

export interface NewRepairModel {
  commercialName: string;
  manufacturerCode?: string;
  manufacturer?: string;
  deviceType?: RepairDeviceType;
}

export function isRepairDeviceType(value: unknown): value is RepairDeviceType {
  return value === "bicycle" || value === "scooter";
}

export function modelMatchesDevice(model: ToolModel, type: RepairDeviceType): boolean {
  return !model.archived && model.category === REPAIR_DEVICE_CATEGORY[type];
}

export function findDuplicateModel(models: ToolModel[], name: string, type: RepairDeviceType): ToolModel | undefined {
  const normalized = name.trim().toLocaleLowerCase();
  return models.find((model) =>
    modelMatchesDevice(model, type) && model.commercialName.trim().toLocaleLowerCase() === normalized
  );
}

export function makePendingRepairModel(data: NewRepairModel, type: RepairDeviceType, now: string): ToolModel {
  return {
    id: newId(),
    commercialName: data.commercialName.trim(),
    manufacturerCode: data.manufacturerCode?.trim() ?? "",
    manufacturer: data.manufacturer?.trim() ?? "",
    category: REPAIR_DEVICE_CATEGORY[type],
    country: "",
    notes: "נוסף מתוך מודול תיקונים",
    archived: false,
    approval: { status: "pending" },
    createdAt: now,
    updatedAt: now,
  };
}
