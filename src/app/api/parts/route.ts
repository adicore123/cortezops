import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId } from "@/lib/db/store";
import { requireArea, hasPermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import type { Part, ToolModel } from "@/lib/types";

/** רשימת חלקים. עלות היבואן מוסתרת ממי שאין לו הרשאה. */
export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "inventory");
  if ("error" in res) return res.error;

  const showCosts = hasPermission(res.user, "viewCosts");
  const [parts, models] = await Promise.all([
    readCollection<Part>("parts"),
    readCollection<ToolModel>("models"),
  ]);

  const items = parts
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((p) => ({
      ...p,
      importCost: showCosts ? p.importCost : undefined,
      compatibleModels: p.compatibleModelIds
        .map((id) => models.find((m) => m.id === id)?.commercialName)
        .filter(Boolean) as string[],
    }));

  return json({ parts: items, showCosts });
});

export const POST = route(async (req: NextRequest) => {
  const res = await requireArea(req, "inventory");
  if ("error" in res) return res.error;

  const data = await body<Partial<Part>>(req);
  if (!data.sku?.trim()) return bad("נדרש מק״ט ייחודי");
  if (!data.name?.trim()) return bad("נדרש שם חלק");

  const parts = await readCollection<Part>("parts");
  if (parts.some((p) => p.sku.toLowerCase() === data.sku!.trim().toLowerCase())) {
    return bad("קיים כבר חלק עם מק״ט זהה");
  }

  const settings = await getSettings();
  const now = new Date().toISOString();
  const part: Part = {
    id: newId(),
    sku: data.sku.trim(),
    name: data.name.trim(),
    partModel: data.partModel ?? "",
    manufacturer: data.manufacturer ?? "",
    imageFileIds: data.imageFileIds ?? [],
    category: data.category ?? settings.partCategories[0] ?? "אחר",
    qty: Number(data.qty ?? 0) || 0,
    shopPrice: data.shopPrice !== undefined ? Number(data.shopPrice) : undefined,
    importCost: data.importCost !== undefined ? Number(data.importCost) : undefined,
    compatibleModelIds: data.compatibleModelIds ?? [],
    notes: data.notes ?? "",
    createdAt: now,
    updatedAt: now,
  };
  await writeCollection<Part>("parts", (items) => [part, ...items]);
  return json({ part }, 201);
});
