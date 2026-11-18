import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId } from "@/lib/db/store";
import { requireUser, canAccess } from "@/lib/auth";
import { storage } from "@/lib/db/storage";
import type { FaultDoc, StoredFile, ToolModel } from "@/lib/types";

/** רשימת מסמכי מרכז תקלות — צפייה לכל מחובר. פילטרים: model/category/q. */
export const GET = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;

  const params = new URL(req.url).searchParams;
  const modelId = params.get("modelId") ?? "";
  const category = params.get("category") ?? "";
  const q = (params.get("q") ?? "").trim().toLowerCase();

  const [docs, files, models] = await Promise.all([
    readCollection<FaultDoc>("faultDocs"),
    readCollection<StoredFile>("files"),
    readCollection<ToolModel>("models"),
  ]);

  const items = docs
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .filter((d) => {
      if (modelId && !d.modelIds.includes(modelId)) return false;
      if (category && d.category !== category) return false;
      if (q) {
        const hay = [d.title, d.code ?? "", d.notes ?? "", d.originalName]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((d) => ({
      ...d,
      file: files.find((f) => f.id === d.fileId) ?? null,
      modelNames: d.modelIds
        .map((id) => models.find((m) => m.id === id)?.commercialName)
        .filter(Boolean) as string[],
    }));

  return json({
    faultDocs: items,
    filters: {
      models: models.filter((m) => !m.archived).map((m) => ({ id: m.id, name: m.commercialName })),
    },
    canManage: res.user.role === "admin" || canAccess(res.user, "service"),
  });
});

export const POST = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  if (res.user.role === "agent") return bad("אין הרשאה לפעולה זו", 403);

  const data = await body<{
    modelIds: string[];
    title: string;
    category: FaultDoc["category"];
    code?: string;
    notes?: string;
    fileId: string;
  }>(req);

  if (!data.title?.trim()) return bad("נדרשת כותרת");
  if (!data.fileId) return bad("נדרש קובץ");
  if (!Array.isArray(data.modelIds) || data.modelIds.length === 0) return bad("בחרו לפחות דגם אחד");

  const files = await readCollection<StoredFile>("files");
  const file = files.find((f) => f.id === data.fileId);
  if (!file) return bad("הקובץ לא נמצא — העלו מחדש", 404);

  const doc: FaultDoc = {
    id: newId(),
    modelIds: data.modelIds,
    title: data.title.trim(),
    category: (["fault", "display", "manual", "other"].includes(data.category) ? data.category : "other") as FaultDoc["category"],
    code: data.code?.trim() || undefined,
    notes: data.notes?.trim() || undefined,
    fileId: data.fileId,
    originalName: file.originalName,
    uploadedBy: res.user.name,
    uploadedAt: new Date().toISOString(),
  };

  await writeCollection<FaultDoc>("faultDocs", (items) => [doc, ...items]);
  return json({ faultDoc: doc }, 201);
});
