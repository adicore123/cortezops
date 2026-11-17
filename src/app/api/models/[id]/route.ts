import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, updateById, getById } from "@/lib/db/store";
import { requireUser, canAccess } from "@/lib/auth";
import { APPROVAL_LABELS } from "@/lib/types";
import type { ToolModel, InspectionCase, Defect, Part, ServiceCall, CaseDocument, ModelApproval, ApprovalStatus } from "@/lib/types";

/** כרטיס דגם: פרטים + תיקים + חלפים תואמים + קריאות + מסמכים + היסטוריה — לפי הרשאות המשתמש. */
export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const model = await getById<ToolModel>("models", id);
  if (!model) return bad("דגם לא נמצא", 404);

  const out: Record<string, unknown> = { model };

  if (canAccess(res.user, "cases")) {
    const [cases, defects, documents] = await Promise.all([
      readCollection<InspectionCase>("cases"),
      readCollection<Defect>("defects"),
      readCollection<CaseDocument>("documents"),
    ]);
    const modelCases = cases
      .filter((c) => c.modelId === id)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    out.cases = modelCases.map((c) => {
      const defs = defects.filter((d) => d.caseId === c.id);
      return {
        ...c,
        openDefects: defs.filter((d) => d.status !== "verified" && d.status !== "fixed").length,
      };
    });

    const caseById = new Map(modelCases.map((c) => [c.id, c]));
    const caseIds = new Set(caseById.keys());
    out.documents = documents
      .filter((d) => caseIds.has(d.caseId))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      .slice(0, 40)
      .map((d) => ({
        id: d.id,
        caseId: d.caseId,
        caseNumber: caseById.get(d.caseId)?.caseNumber ?? "",
        title: d.title || d.originalName,
        type: d.type,
        uploadedBy: d.uploadedBy,
        uploadedAt: d.uploadedAt,
      }));

    // היסטוריה מאוחדת: אירועי התיקים של הדגם + רישום אישור פנימי
    const history: { at: string; action: string; user?: string; caseNumber?: string }[] = [];
    for (const c of modelCases) {
      for (const h of c.history) history.push({ at: h.at, action: h.action, user: h.user, caseNumber: c.caseNumber });
    }
    if (model.approval.approver) {
      history.push({
        at: model.approval.date ?? model.updatedAt,
        action: `אישור פנימי: ${APPROVAL_LABELS[model.approval.status]}`,
        user: model.approval.approver,
      });
    }
    out.history = history.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  }

  if (canAccess(res.user, "inventory")) {
    const parts = await readCollection<Part>("parts");
    out.parts = parts.filter((p) => p.compatibleModelIds.includes(id));
  }

  const calls = await readCollection<ServiceCall>("serviceCalls");
  out.serviceCalls = calls
    .filter((c) => c.modelId === id && (res.user.role !== "agent" || c.agentId === res.user.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return json(out);
});

/** עריכת דגם / ארכוב / אישור פנימי. */
export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  if (res.user.role === "agent") return bad("אין הרשאה לפעולה זו", 403);

  const { id } = await ctx.params;
  const data = await body<{
    archived?: boolean;
    approvalStatus?: ApprovalStatus;
    approvalNote?: string;
    fields?: Partial<ToolModel>;
  }>(req);

  const updated = await updateById<ToolModel>("models", id, (m) => {
    let next = { ...m, updatedAt: new Date().toISOString() };
    if (data.archived !== undefined) next.archived = data.archived;
    if (data.fields) {
      const { commercialName, manufacturerCode, manufacturer, category, country, notes } = data.fields;
      next = {
        ...next,
        commercialName: commercialName?.trim() || next.commercialName,
        manufacturerCode: manufacturerCode ?? next.manufacturerCode,
        manufacturer: manufacturer ?? next.manufacturer,
        category: category ?? next.category,
        country: country ?? next.country,
        notes: notes ?? next.notes,
      };
    }
    if (data.approvalStatus) {
      const approval: ModelApproval = {
        status: data.approvalStatus,
        approver: res.user.name,
        date: new Date().toISOString(),
        note: data.approvalNote ?? "",
      };
      next.approval = approval;
    }
    return next;
  });

  if (!updated) return bad("דגם לא נמצא", 404);
  return json({ model: updated });
});
