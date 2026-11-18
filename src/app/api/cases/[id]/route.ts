import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, updateById, getById, newId, writeCollection } from "@/lib/db/store";
import { storage } from "@/lib/db/storage";
import { requireArea } from "@/lib/auth";
import { CASE_STATUS_LABELS } from "@/lib/types";
import type { InspectionCase, Defect, CaseDocument, ToolModel, StoredFile, CaseStatus, CaseChecklistItem, Part } from "@/lib/types";

export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const kase = await getById<InspectionCase>("cases", id);
  if (!kase) return bad("תיק לא נמצא", 404);

  const [models, defects, documents, files] = await Promise.all([
    readCollection<ToolModel>("models"),
    readCollection<Defect>("defects"),
    readCollection<CaseDocument>("documents"),
    readCollection<StoredFile>("files"),
  ]);

  const caseDefects = defects
    .filter((d) => d.caseId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const caseDocs = documents
    .filter((d) => d.caseId === id)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .map((d) => ({ ...d, file: files.find((f) => f.id === d.fileId) ?? null }));

  return json({
    case: kase,
    model: models.find((m) => m.id === kase.modelId) ?? null,
    defects: caseDefects,
    documents: caseDocs,
  });
});

interface PatchCaseBody {
  fields?: Partial<Pick<InspectionCase, "sampleId" | "owner" | "dueDate" | "notes" | "nextAction">>;
  order?: Partial<InspectionCase["order"]>;
  inspection?: Partial<InspectionCase["inspection"]>;
  status?: CaseStatus;
  approveInstitute?: boolean; // אישור מכון התקנים → נכנס להיסטוריה
  checklist?: CaseChecklistItem[];
  checklistAdd?: string;
  checklistRemove?: string;
  checklistToggle?: string;
}

export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;
  const data = await body<PatchCaseBody>(req);

  const existing = await getById<InspectionCase>("cases", id);
  if (!existing) return bad("תיק לא נמצא", 404);

  const now = new Date().toISOString();
  const history: typeof existing.history = [];

  const updated = await updateById<InspectionCase>("cases", id, (c) => {
    let next: InspectionCase = { ...c, updatedAt: now };

    if (data.fields) next = { ...next, ...data.fields };
    if (data.order) next = { ...next, order: { ...next.order, ...data.order } };
    if (data.inspection) next = { ...next, inspection: { ...next.inspection, ...data.inspection } };

    if (data.status && data.status !== c.status) {
      history.push({
        at: now,
        user: res.user.name,
        action: "עדכון סטטוס",
        from: CASE_STATUS_LABELS[c.status],
        to: CASE_STATUS_LABELS[data.status],
      });
      next.status = data.status;
    }

    // אישור מכון התקנים — התיק מסומן ונכנס להיסטוריה
    if (data.approveInstitute && !c.approvedAt) {
      next.approvedAt = now;
      next.approvedBy = res.user.name;
      next.status = "completed";
      history.push({ at: now, user: res.user.name, action: "התיק אושר ע״י מכון התקנים — נכנס להיסטוריה", to: "מאושר" });
    }

    if (data.checklist) {
      const removed = c.checklist.filter((old) => !data.checklist!.some((n) => n.id === old.id));
      if (removed.length) history.push({ at: now, user: res.user.name, action: `הוסרו השלמות: ${removed.map((r) => r.label).join(", ")}` });
      const newlyDone = data.checklist.filter((n) => n.done && !c.checklist.find((o) => o.id === n.id)?.done);
      if (newlyDone.length) history.push({ at: now, user: res.user.name, action: `הושלמו: ${newlyDone.map((r) => r.label).join(", ")}` });
      next.checklist = data.checklist;
    }
    if (data.checklistAdd?.trim()) {
      const item: CaseChecklistItem = { id: newId(), label: data.checklistAdd.trim(), done: false };
      next.checklist = [...next.checklist, item];
      history.push({ at: now, user: res.user.name, action: `נוספה השלמה: ${item.label}` });
    }
    if (data.checklistRemove) next.checklist = next.checklist.filter((i) => i.id !== data.checklistRemove);
    if (data.checklistToggle) {
      next.checklist = next.checklist.map((i) => (i.id === data.checklistToggle ? { ...i, done: !i.done } : i));
    }

    if (data.inspection?.certificateNo && data.inspection.certificateNo !== c.inspection.certificateNo) {
      history.push({ at: now, user: res.user.name, action: `נקלט מספר תעודה ${data.inspection.certificateNo}` });
    }

    next.history = [...c.history, ...history];
    return next;
  });

  if (!updated) return bad("תיק לא נמצא", 404);
  return json({ case: updated });
});

/** מחיקת תיק — קסקדה: ליקויים, מסמכים וקבצים שאינם משותפים. */
export const DELETE = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const [cases, defects, documents, parts, settingsRows] = await Promise.all([
    readCollection<InspectionCase>("cases"),
    readCollection<Defect>("defects"),
    readCollection<CaseDocument>("documents"),
    readCollection<Part>("parts"),
    readCollection("settings"),
  ]);
  const kase = cases.find((c) => c.id === id);
  if (!kase) return bad("תיק לא נמצא", 404);

  const caseDefects = defects.filter((d) => d.caseId === id);
  const caseDocs = documents.filter((d) => d.caseId === id);

  // קבצים מוגנים: לוגו, תמונות חלפים, וקבצים השייכים לתיקים/ליקויים אחרים
  const settings = settingsRows[0] as { importer?: { logoFileId?: string } } | undefined;
  const protectedIds = new Set<string>();
  if (settings?.importer?.logoFileId) protectedIds.add(settings.importer.logoFileId);
  for (const p of parts) for (const fid of p.imageFileIds) protectedIds.add(fid);
  for (const d of documents.filter((x) => x.caseId !== id)) protectedIds.add(d.fileId);
  for (const d of defects.filter((x) => x.caseId !== id)) {
    for (const fid of [...d.fix.beforeFileIds, ...d.fix.afterFileIds]) protectedIds.add(fid);
  }

  const doomed = new Set<string>();
  for (const d of caseDocs) doomed.add(d.fileId);
  for (const d of caseDefects) {
    for (const fid of [...d.fix.beforeFileIds, ...d.fix.afterFileIds]) doomed.add(fid);
  }
  const filesToDelete = [...doomed].filter((fid) => !protectedIds.has(fid));

  // מחיקות
  await writeCollection<InspectionCase>("cases", (items) => items.filter((c) => c.id !== id));
  await writeCollection<Defect>("defects", (items) => items.filter((d) => d.caseId !== id));
  await writeCollection<CaseDocument>("documents", (items) => items.filter((d) => d.caseId !== id));
  await writeCollection("files", (items: StoredFile[]) => items.filter((f) => !filesToDelete.includes(f.id)));
  for (const fid of filesToDelete) {
    await storage.deleteUpload(fid).catch(() => undefined);
  }

  return json({ ok: true, deleted: { defects: caseDefects.length, documents: caseDocs.length, files: filesToDelete.length } });
});
