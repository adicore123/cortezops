import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, updateById, getById, writeCollection } from "@/lib/db/store";
import { requireArea, hasPermission } from "@/lib/auth";
import type { Part, PartMovement, ToolModel, StoredFile } from "@/lib/types";

export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "inventory");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const part = await getById<Part>("parts", id);
  if (!part) return bad("חלק לא נמצא", 404);

  const [movements, models, files] = await Promise.all([
    readCollection<PartMovement>("movements"),
    readCollection<ToolModel>("models"),
    readCollection<StoredFile>("files"),
  ]);

  return json({
    part: hasPermission(res.user, "viewCosts") ? part : { ...part, importCost: undefined },
    movements: movements
      .filter((m) => m.partId === id)
      .sort((a, b) => b.at.localeCompare(a.at)),
    models: models.filter((m) => !m.archived),
    files: files.filter((f) => part.imageFileIds.includes(f.id)),
  });
});

export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "inventory");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const data = await body<Partial<Part>>(req);
  const updated = await updateById<Part>("parts", id, (p) => ({
    ...p,
    ...("sku" in data && data.sku?.trim() ? { sku: data.sku.trim() } : {}),
    ...("name" in data && data.name?.trim() ? { name: data.name.trim() } : {}),
    partModel: data.partModel ?? p.partModel,
    manufacturer: data.manufacturer ?? p.manufacturer,
    category: data.category ?? p.category,
    imageFileIds: data.imageFileIds ?? p.imageFileIds,
    shopPrice: data.shopPrice !== undefined ? Number(data.shopPrice) : p.shopPrice,
    importCost: data.importCost !== undefined ? Number(data.importCost) : p.importCost,
    compatibleModelIds: data.compatibleModelIds ?? p.compatibleModelIds,
    notes: data.notes ?? p.notes,
    updatedAt: new Date().toISOString(),
  }));

  if (!updated) return bad("חלק לא נמצא", 404);
  return json({ part: updated });
});

export const DELETE = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "inventory");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  await writeCollection<Part>("parts", (items) => items.filter((p) => p.id !== id));
  await writeCollection<PartMovement>("movements", (items) => items.filter((m) => m.partId !== id));
  return json({ ok: true });
});
