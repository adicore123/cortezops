import { NextRequest } from "next/server";
import { route, json, bad } from "@/lib/api";
import { newId, writeCollection } from "@/lib/db/store";
import { storage } from "@/lib/db/storage";
import { requireUser } from "@/lib/auth";
import type { StoredFile } from "@/lib/types";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXT = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "svg", "heic"]);

export const POST = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return bad("לא נשלח קובץ");
  if (file.size > MAX_SIZE) return bad("הקובץ גדול מ־25MB");

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return bad("סוג קובץ לא נתמך (PDF, תמונות בלבד)");

  const id = newId();
  const stored: StoredFile = {
    id,
    originalName: file.name,
    ext,
    mime: file.type || "application/octet-stream",
    size: file.size,
    uploadedBy: res.user.name,
    uploadedAt: new Date().toISOString(),
  };

  await storage.saveUpload(id, Buffer.from(await file.arrayBuffer()));
  await writeCollection<StoredFile>("files", (items) => [...items, stored]);

  return json({ file: stored }, 201);
});
