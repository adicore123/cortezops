import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId, getById } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import type { InspectionCase, Defect } from "@/lib/types";

export const POST = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const kase = await getById<InspectionCase>("cases", id);
  if (!kase) return bad("תיק לא נמצא", 404);

  const data = await body<Partial<Defect>>(req);
  if (!data.title?.trim()) return bad("נדרשת כותרת ליקוי");

  const settings = await getSettings();
  const now = new Date().toISOString();

  const defect: Defect = {
    id: newId(),
    caseId: id,
    category: data.category ?? settings.defectCategories[0] ?? "אחר",
    title: data.title.trim(),
    asReceived: data.asReceived ?? "",
    certificateSection: data.certificateSection ?? "",
    certificatePage: data.certificatePage ?? "",
    requiredChange: data.requiredChange ?? "",
    owner: data.owner ?? res.user.name,
    dueDate: data.dueDate,
    status: "open",
    needsRecheck: Boolean(data.needsRecheck),
    sticker: {
      existingText: data.sticker?.existingText ?? "",
      requiredText: data.sticker?.requiredText ?? "",
      updatedText: data.sticker?.updatedText ?? "",
      location: data.sticker?.location ?? "",
    },
    fix: { beforeFileIds: [], afterFileIds: [], description: "", performer: "" },
    verification: {},
    history: [{ at: now, user: res.user.name, action: "הליקוי נפתח", to: "פתוח" }],
    createdAt: now,
    updatedAt: now,
  };

  await writeCollection<Defect>("defects", (items) => [...items, defect]);

  // עדכון היסטוריית התיק
  await writeCollection<InspectionCase>("cases", (items) =>
    items.map((c) =>
      c.id === id
        ? { ...c, updatedAt: now, history: [...c.history, { at: now, user: res.user.name, action: `נפתח ליקוי: ${defect.title}` }] }
        : c
    )
  );

  return json({ defect }, 201);
});

export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  const defects = await readCollection<Defect>("defects");
  return json({ defects: defects.filter((d) => d.caseId === id) });
});
