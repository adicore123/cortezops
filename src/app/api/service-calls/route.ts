import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId, nextNumber } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import type { ServiceCall, ToolModel, Part, Notification, ServiceCallStatus } from "@/lib/types";

/** רשימת קריאות: יבואן רואה הכול, סוכן רואה את הקריאות שפתח בלבד. */
export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;

  const [calls, models] = await Promise.all([
    readCollection<ServiceCall>("serviceCalls"),
    readCollection<ToolModel>("models"),
  ]);

  const scoped = calls
    .filter((c) => res.user.role !== "agent" || c.agentId === res.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => ({ ...c, modelName: models.find((m) => m.id === c.modelId)?.commercialName ?? "—" }));

  return json({ calls: scoped });
});

/** פתיחת קריאה — הסוכן/המשתמש משויך אוטומטית, נוצרת התראה ליבואן. */
export const POST = route(async (req: NextRequest) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;

  const data = await body<{
    modelId?: string;
    frameNumber?: string;
    contactName?: string;
    contactPhone?: string;
    description: string;
    attachmentFileIds?: string[];
    linkedPartIds?: string[];
  }>(req);

  if (!data.description?.trim()) return bad("נדרש תיאור התקלה");

  const [parts, models] = await Promise.all([
    readCollection<Part>("parts"),
    readCollection<ToolModel>("models"),
  ]);
  if (data.modelId && !models.some((m) => m.id === data.modelId)) return bad("דגם לא נמצא", 404);
  for (const pid of data.linkedPartIds ?? []) {
    if (!parts.some((p) => p.id === pid)) return bad("חלק מקושר לא נמצא", 404);
  }

  const now = new Date().toISOString();
  const callNumber = await nextNumber("serviceCalls", "SC");
  const call: ServiceCall = {
    id: newId(),
    callNumber,
    agentId: res.user.id,
    agentName: res.user.name,
    modelId: data.modelId,
    frameNumber: data.frameNumber ?? "",
    contactName: data.contactName ?? "",
    contactPhone: data.contactPhone ?? "",
    description: data.description.trim(),
    attachmentFileIds: data.attachmentFileIds ?? [],
    linkedPartIds: data.linkedPartIds ?? [],
    status: "new",
    treatmentLog: [],
    history: [],
    createdAt: now,
    updatedAt: now,
  };
  await writeCollection<ServiceCall>("serviceCalls", (items) => [call, ...items]);

  // התראה ליבואן
  const modelName = data.modelId ? models.find((m) => m.id === data.modelId)?.commercialName : null;
  const notification: Notification = {
    id: newId(),
    audience: ["admin", "staff"],
    message: `קריאת שירות חדשה ${callNumber} מ${res.user.name}${modelName ? ` — ${modelName}` : ""}`,
    link: `/service/${call.id}`,
    readBy: [],
    createdAt: now,
  };
  await writeCollection<Notification>("notifications", (items) => [notification, ...items]);

  return json({ call }, 201);
});
