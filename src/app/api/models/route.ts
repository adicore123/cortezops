import { NextRequest } from "next/server";
import { route, json, bad, body, clean } from "@/lib/api";
import { readCollection, writeCollection, newId } from "@/lib/db/store";
import { requireUser } from "@/lib/auth";
import type { ToolModel, InspectionCase, Part, ApprovalStatus } from "@/lib/types";

/** רשימת דגמים עם מספרי קישורים. סוכן מקבל דגמים פעילים בלבד (לצורך פתיחת קריאה). */
export const GET = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;

  const [models, cases, parts] = await Promise.all([
    readCollection<ToolModel>("models"),
    readCollection<InspectionCase>("cases"),
    readCollection<Part>("parts"),
  ]);

  const items = models
    .filter((m) => (res.user.role === "agent" ? !m.archived : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((m) => ({
      ...m,
      caseCount: cases.filter((c) => c.modelId === m.id).length,
      partCount: parts.filter((p) => p.compatibleModelIds.includes(m.id)).length,
    }));

  return json({ models: items });
});

export const POST = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  if (res.user.role === "agent") return bad("אין הרשאה לפעולה זו", 403);

  const data = await body<Partial<ToolModel> & { approvalStatus?: ApprovalStatus }>(req);
  if (!data.commercialName?.trim()) return bad("נדרש שם מסחרי לדגם");

  const now = new Date().toISOString();
  const model: ToolModel = {
    id: newId(),
    commercialName: data.commercialName.trim(),
    manufacturerCode: data.manufacturerCode?.trim() ?? "",
    manufacturer: data.manufacturer?.trim() ?? "",
    category: data.category ?? "",
    country: data.country ?? "",
    notes: data.notes ?? "",
    archived: false,
    approval: { status: data.approvalStatus ?? "pending" },
    createdAt: now,
    updatedAt: now,
  };
  await writeCollection<ToolModel>("models", (items) => [model, ...items]);
  return json({ model }, 201);
});
