import { NextRequest, NextResponse } from "next/server";
import { route, bad } from "@/lib/api";
import { readCollection } from "@/lib/db/store";
import { storage } from "@/lib/db/storage";
import { requireUser } from "@/lib/auth";
import type { StoredFile, ServiceCall } from "@/lib/types";

/** הורדת/צפייה בקובץ — כולל בדיקת הרשאה: סוכן רואה רק קבצים של הקריאות שלו. */
export const GET = route(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  const { id } = await ctx.params;

  const files = await readCollection<StoredFile>("files");
  const file = files.find((f) => f.id === id);
  if (!file) return bad("קובץ לא נמצא", 404);

  if (res.user.role === "agent") {
    const calls = await readCollection<ServiceCall>("serviceCalls");
    const owns = calls.some(
      (c) => c.agentId === res.user.id && c.attachmentFileIds.includes(id)
    );
    if (!owns) return bad("אין הרשאה לקובץ זה", 403);
  }

  const download = new URL(req.url).searchParams.get("download") === "1";

  // ב־Vercel: הפניה לכתובת חתומה אחרי בדיקת ההרשאה (יעיל לקבצים גדולים)
  const signed = await storage.uploadDownloadUrl(id);
  if (signed) {
    return NextResponse.redirect(
      download ? `${signed}${signed.includes("?") ? "&" : "?"}download=1` : signed,
      302
    );
  }

  // אחסון מקומי: הזרמה ישירה
  const buf = await storage.readUpload(id);
  if (!buf) return bad("תוכן הקובץ חסר", 404);

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});
