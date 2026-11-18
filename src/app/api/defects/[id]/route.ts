import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, updateById, writeCollection } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import { DEFECT_STATUS_LABELS } from "@/lib/types";
import type { Defect, DefectStatus, StoredFile, InspectionCase, CaseDocument } from "@/lib/types";

interface PatchDefectBody {
  fields?: Partial<Pick<Defect, "category" | "title" | "asReceived" | "certificateSection" | "certificatePage" | "requiredChange" | "owner" | "dueDate" | "needsRecheck">>;
  sticker?: Partial<Defect["sticker"]>;
  status?: DefectStatus;
  fix?: Partial<Defect["fix"]> & { beforeAdd?: StoredFile; afterAdd?: StoredFile };
  verification?: Partial<Defect["verification"]>;
}

export const PATCH = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const data = await body<PatchDefectBody>(req);
  const now = new Date().toISOString();
  const history: Defect["history"] = [];

  const updated = await updateById<Defect>("defects", id, (d) => {
    let next: Defect = { ...d, updatedAt: now };

    if (data.fields) next = { ...next, ...data.fields };
    if (data.sticker) next = { ...next, sticker: { ...next.sticker, ...data.sticker } };

    if (data.fix) {
      const { beforeAdd, afterAdd, ...fixRest } = data.fix;
      next.fix = { ...next.fix, ...fixRest };
      if (beforeAdd) next.fix = { ...next.fix, beforeFileIds: [...next.fix.beforeFileIds, beforeAdd.id] };
      if (afterAdd) next.fix = { ...next.fix, afterFileIds: [...next.fix.afterFileIds, afterAdd.id] };
      if (fixRest.description && fixRest.description !== d.fix.description) {
        history.push({ at: now, user: res.user.name, action: "תועד תיקון" });
      }
    }

    if (data.verification) {
      next.verification = { ...next.verification, ...data.verification };
    }

    // מעבר סטטוס: תיקון שתועד ודורש בדיקה חוזרת → ממתין לאימות אוטומטית
    if (data.status && data.status !== d.status) {
      history.push({
        at: now,
        user: res.user.name,
        action: "עדכון סטטוס",
        from: DEFECT_STATUS_LABELS[d.status],
        to: DEFECT_STATUS_LABELS[data.status],
      });
      next.status = data.status;

      if (data.status === "verified") {
        next.verification = { ...next.verification, verifiedAt: now, verifiedBy: res.user.name };
      }
      if (data.status === "fixed" && d.needsRecheck && next.fix.description) {
        // המדבקה תוקנה אצל היבואן — עדיין ממתין לבדיקה חוזרת
        next.status = "awaitingVerification";
        history.push({
          at: now,
          user: res.user.name,
          action: "נדרשת בדיקה חוזרת — הועבר לממתין לאימות",
          from: DEFECT_STATUS_LABELS.fixed,
          to: DEFECT_STATUS_LABELS.awaitingVerification,
        });
      }
    }

    next.history = [...d.history, ...history];
    return next;
  });

  if (!updated) return bad("ליקוי לא נמצא", 404);
  return json({ defect: updated });
});

/** מחיקת ליקוי — מנוקה ממסמכים מקושרים ונרשם בהיסטוריית התיק. */
export const DELETE = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const defects = await readCollection<Defect>("defects");
  const defect = defects.find((d) => d.id === id);
  if (!defect) return bad("ליקוי לא נמצא", 404);
  const now = new Date().toISOString();

  await writeCollection<Defect>("defects", (items) => items.filter((d) => d.id !== id));
  await writeCollection<CaseDocument>("documents", (items) =>
    items.map((d) =>
      d.defectIds.includes(id) ? { ...d, defectIds: d.defectIds.filter((x) => x !== id) } : d
    )
  );
  await writeCollection<InspectionCase>("cases", (items) =>
    items.map((c) =>
      c.id === defect.caseId
        ? {
            ...c,
            updatedAt: now,
            history: [...c.history, { at: now, user: res.user.name, action: `נמחק ליקוי: ${defect.title}` }],
          }
        : c
    )
  );

  return json({ ok: true });
});
