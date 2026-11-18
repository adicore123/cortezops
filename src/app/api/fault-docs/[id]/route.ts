import { NextRequest } from "next/server";
import { route, json, bad } from "@/lib/api";
import { readCollection, writeCollection } from "@/lib/db/store";
import { requireUser } from "@/lib/auth";
import { storage } from "@/lib/db/storage";
import type { FaultDoc, StoredFile } from "@/lib/types";

/** מחיקת מסמך ממרכז התקלות — admin/צוות בלבד (כולל פינוי הקובץ מ־GridFS). */
export const DELETE = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  if (res.user.role === "agent") return bad("אין הרשאה לפעולה זו", 403);
  const { id } = await ctx.params;

  const docs = await readCollection<FaultDoc>("faultDocs");
  const doc = docs.find((d) => d.id === id);
  if (!doc) return bad("מסמך לא נמצא", 404);

  await writeCollection<FaultDoc>("faultDocs", (items) => items.filter((d) => d.id !== id));
  // פינוי הקובץ מהאחסון (אינו משותף עם ישויות אחרות)
  await storage.deleteUpload(doc.fileId).catch(() => undefined);
  await writeCollection<StoredFile>("files", (items) => items.filter((f) => f.id !== doc.fileId));

  return json({ ok: true });
});
