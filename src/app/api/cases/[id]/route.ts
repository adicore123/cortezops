import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, updateById, getById, newId } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import { CASE_STATUS_LABELS } from "@/lib/types";
import type { InspectionCase, Defect, CaseDocument, ToolModel, StoredFile, CaseStatus, CaseChecklistItem } from "@/lib/types";

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
