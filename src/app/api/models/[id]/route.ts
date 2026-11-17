import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, updateById, getById } from "@/lib/db/store";
import { requireUser, canAccess } from "@/lib/auth";
import type { ToolModel, InspectionCase, Defect, Part, ServiceCall, ModelApproval, ApprovalStatus } from "@/lib/types";

/** כרטיס דגם: פרטים + תיקים + חלפים תואמים + קריאות — לפי הרשאות המשתמש. */
export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const model = await getById<ToolModel>("models", id);
  if (!model) return bad("דגם לא נמצא", 404);

  const out: Record<string, unknown> = { model };

  if (canAccess(res.user, "cases")) {
    const [cases, defects] = await Promise.all([
      readCollection<InspectionCase>("cases"),
      readCollection<Defect>("defects"),
    ]);
    out.cases = cases
      .filter((c) => c.modelId === id)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      .map((c) => {
        const defs = defects.filter((d) => d.caseId === c.id);
        return {
          ...c,
          openDefects: defs.filter((d) => d.status !== "verified" && d.status !== "fixed").length,
        };
      });
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
