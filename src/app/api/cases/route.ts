import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId, nextNumber } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import type { ToolModel, InspectionCase, Defect, CaseStatus } from "@/lib/types";

export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;

  const [cases, models, defects] = await Promise.all([
    readCollection<InspectionCase>("cases"),
    readCollection<ToolModel>("models"),
    readCollection<Defect>("defects"),
  ]);

  const items = cases
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .map((c) => {
      const model = models.find((m) => m.id === c.modelId);
      const defs = defects.filter((d) => d.caseId === c.id);
      return {
        ...c,
        modelName: model?.commercialName ?? "—",
        openDefects: defs.filter((d) => d.status !== "verified").length,
        awaitingVerification: defs.filter((d) => d.status === "awaitingVerification").length,
        missingItems: c.checklist.filter((i) => !i.done).length,
      };
    });

  return json({ cases: items });
});

interface CreateCaseBody {
  modelId?: string;
  newModel?: { commercialName: string; manufacturerCode?: string; manufacturer?: string; category?: string; country?: string };
  sampleId?: string;
  owner?: string;
  dueDate?: string;
  status?: CaseStatus;
  notes?: string;
  nextAction?: string;
}

export const POST = route(async (req: NextRequest) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;

  const data = await body<CreateCaseBody>(req);
  const now = new Date().toISOString();

  // דגם קיים או יצירה מתוך הטופס — כולל דגם שטרם אושר פנימית
  let modelId = data.modelId;
  if (!modelId) {
    const nm = data.newModel;
    if (!nm?.commercialName?.trim()) return bad("בחרו דגם קיים או הזינו שם של דגם חדש");
    modelId = newId();
    const model: ToolModel = {
      id: modelId,
      commercialName: nm.commercialName.trim(),
      manufacturerCode: nm.manufacturerCode ?? "",
      manufacturer: nm.manufacturer ?? "",
      category: nm.category ?? "",
      country: nm.country ?? "",
      notes: "",
      archived: false,
      approval: { status: "pending" },
      createdAt: now,
      updatedAt: now,
    };
    await writeCollection<ToolModel>("models", (items) => [model, ...items]);
  } else {
    const models = await readCollection<ToolModel>("models");
    if (!models.some((m) => m.id === modelId)) return bad("הדגם שנבחר לא נמצא", 404);
  }

  const settings = await getSettings();
  const caseNumber = await nextNumber("cases", "CR");

  const newCase: InspectionCase = {
    id: newId(),
    caseNumber,
    modelId,
    sampleId: data.sampleId ?? "",
    owner: data.owner ?? res.user.name,
    openedAt: now,
    dueDate: data.dueDate,
    status: data.status ?? "draft",
    notes: data.notes ?? "",
    nextAction: data.nextAction ?? "",
    order: {},
    inspection: {},
    checklist: [
      { id: newId(), label: "תעודה מלאה", done: false },
    ],
    history: [{ at: now, user: res.user.name, action: "התיק נפתח", to: "טיוטה" }],
    createdAt: now,
    updatedAt: now,
  };

  await writeCollection<InspectionCase>("cases", (items) => [newCase, ...items]);
  return json({ case: newCase, defaultChecklistHint: settings.defectCategories.length > 0 }, 201);
});
