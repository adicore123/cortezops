import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, updateById, getById, writeCollection } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import { CALL_STATUS_LABELS } from "@/lib/types";
import type { ServiceCall, ToolModel, Part, StoredFile, ServiceCallStatus, Notification } from "@/lib/types";

export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const call = await getById<ServiceCall>("serviceCalls", id);
  if (!call) return bad("קריאה לא נמצאה", 404);
  if (res.user.role === "agent" && call.agentId !== res.user.id) return bad("אין הרשאה לקריאה זו", 403);

  const [models, parts, files] = await Promise.all([
    readCollection<ToolModel>("models"),
    readCollection<Part>("parts"),
    readCollection<StoredFile>("files"),
  ]);

  return json({
    call,
    model: models.find((m) => m.id === call.modelId) ?? null,
    models,
    linkedParts: parts.filter((p) => call.linkedPartIds.includes(p.id)),
    attachments: files.filter((f) => call.attachmentFileIds.includes(f.id)),
    isAgent: res.user.role === "agent",
  });
});

export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "service");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const existing = await getById<ServiceCall>("serviceCalls", id);
  if (!existing) return bad("קריאה לא נמצאה", 404);
  if (res.user.role === "agent" && existing.agentId !== res.user.id) return bad("אין הרשאה לקריאה זו", 403);

  const data = await body<{
    status?: ServiceCallStatus;
    assignee?: string;
    treatmentNote?: string;
    resolution?: string;
    linkedPartIds?: string[];
  }>(req);

  const now = new Date().toISOString();
  const updated = await updateById<ServiceCall>("serviceCalls", id, (c) => {
    let next = { ...c, updatedAt: now };
    const history: NonNullable<ServiceCall["history"]> = [];
    if (res.user.role !== "agent" && data.assignee !== undefined && data.assignee !== (c.assignee ?? "")) {
      next.assignee = data.assignee;
      history.push({ at: now, user: res.user.name, action: "הקצאת אחראי", to: data.assignee || "ללא" });
    }
    if (data.status && data.status !== c.status) {
      next.status = data.status;
      history.push({
        at: now,
        user: res.user.name,
        action: "עדכון סטטוס",
        from: CALL_STATUS_LABELS[c.status],
        to: CALL_STATUS_LABELS[data.status],
      });
    }
    if (data.linkedPartIds) next.linkedPartIds = data.linkedPartIds;
    if (data.treatmentNote?.trim()) {
      next.treatmentLog = [...c.treatmentLog, { id: crypto.randomUUID(), at: now, user: res.user.name, note: data.treatmentNote.trim() }];
    }
    if (data.resolution !== undefined) next.resolution = data.resolution;
    next.history = [...(c.history ?? []), ...history];
    return next;
  });

  if (!updated) return bad("קריאה לא נמצאה", 404);

  // עדכון סטטוס/הקצאה — התראה לסוכן שפתח
  if ((data.status || data.assignee !== undefined) && res.user.role !== "agent") {
    const notes: Notification = {
      id: crypto.randomUUID(),
      audience: ["agent"],
      message: `עדכון בקריאה ${updated.callNumber}: ${data.status ? "סטטוס עודכן" : ""}${data.status && data.assignee !== undefined ? " · " : ""}${data.assignee !== undefined ? `אחראי: ${data.assignee}` : ""}`,
      link: `/service/${id}`,
      readBy: [],
      createdAt: now,
    };
    await writeCollection<Notification>("notifications", (items) => [notes, ...items]);
  }

  return json({ call: updated });
});
