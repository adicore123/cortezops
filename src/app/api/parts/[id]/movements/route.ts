import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId, getById } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import type { Part, PartMovement, MovementType } from "@/lib/types";

/** תנועת מלאי: קליטה / יציאה / התאמת ספירה — עם סיבה והיסטוריה. */
export const POST = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "inventory");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const data = await body<{ type: MovementType; qty: number; reason?: string }>(req);
  if (!["in", "out", "adjust"].includes(data.type)) return bad("סוג תנועה לא תקין");
  if (!Number.isFinite(data.qty)) return bad("נדרשת כמות");

  const part = await getById<Part>("parts", id);
  if (!part) return bad("חלק לא נמצא", 404);

  let newQty = part.qty;
  if (data.type === "in") newQty = part.qty + data.qty;
  else if (data.type === "out") {
    if (data.qty > part.qty) return bad(`אין מספיק מלאי — קיימות ${part.qty} יחידות בלבד`);
    newQty = part.qty - data.qty;
  } else newQty = data.qty; // התאמת ספירה: הכמות שנספרה בפועל

  const now = new Date().toISOString();
  const movement: PartMovement = {
    id: newId(),
    partId: id,
    type: data.type,
    qty: data.qty,
    reason: data.reason ?? "",
    user: res.user.name,
    at: now,
  };
  await writeCollection<PartMovement>("movements", (items) => [movement, ...items]);
  await writeCollection<Part>("parts", (items) =>
    items.map((p) => (p.id === id ? { ...p, qty: newQty, updatedAt: now } : p))
  );

  return json({ movement, newQty }, 201);
});

export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "inventory");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  const movements = await readCollection<PartMovement>("movements");
  return json({ movements: movements.filter((m) => m.partId === id).sort((a, b) => b.at.localeCompare(a.at)) });
});
