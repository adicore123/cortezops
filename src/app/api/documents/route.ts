import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId, getById } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import type { CaseDocument, DocumentType, InspectionCase, StoredFile } from "@/lib/types";

export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const caseId = new URL(req.url).searchParams.get("caseId");

  const [docs, files] = await Promise.all([
    readCollection<CaseDocument>("documents"),
    readCollection<StoredFile>("files"),
  ]);

  const items = docs
    .filter((d) => !caseId || d.caseId === caseId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map((d) => ({ ...d, file: files.find((f) => f.id === d.fileId) ?? null }));

  return json({ documents: items });
});

export const POST = route(async (req: NextRequest) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;

  const data = await body<{
    caseId: string;
    fileId: string;
    type: DocumentType;
    defectIds?: string[];
    title?: string;
    note?: string;
    supersedesId?: string; // דוח קודם שהדוח החדש מחליף
  }>(req);

  if (!data.caseId || !data.fileId || !data.type) return bad("חסרים פרטי מסמך");

  const kase = await getById<InspectionCase>("cases", data.caseId);
  if (!kase) return bad("תיק לא נמצא", 404);

  const files = await readCollection<StoredFile>("files");
  const file = files.find((f) => f.id === data.fileId);
  if (!file) return bad("קובץ לא נמצא — העלו מחדש", 404);

  const now = new Date().toISOString();
  const doc: CaseDocument = {
    id: newId(),
    caseId: data.caseId,
    defectIds: data.defectIds ?? [],
    type: data.type,
    fileId: data.fileId,
    originalName: file.originalName,
    title: data.title ?? file.originalName,
    uploadedBy: res.user.name,
    uploadedAt: now,
    note: data.note ?? "",
  };

  await writeCollection<CaseDocument>("documents", (items) => [doc, ...items]);

  // דוח מעודכן שמחליף דוח קודם — הקודם נשמר להיסטוריה
  if (data.supersedesId) {
    await writeCollection<CaseDocument>("documents", (items) =>
      items.map((d) => (d.id === data.supersedesId ? { ...d, supersededBy: doc.id } : d))
    );
  }

  await writeCollection<InspectionCase>("cases", (items) =>
    items.map((c) =>
      c.id === data.caseId
        ? { ...c, updatedAt: now, history: [...c.history, { at: now, user: res.user.name, action: `נוסף מסמך: ${doc.title}` }] }
        : c
    )
  );

  return json({ document: doc }, 201);
});

export const DELETE = route(async (req: NextRequest) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("חסר מזהה מסמך");

  await writeCollection<CaseDocument>("documents", (items) => items.filter((d) => d.id !== id));
  return json({ ok: true });
});
