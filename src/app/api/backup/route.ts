import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { storage } from "@/lib/db/storage";
import { requireArea } from "@/lib/auth";

const COLLECTIONS = [
  "users", "models", "cases", "defects", "documents",
  "files", "parts", "movements", "serviceCalls", "notifications", "settings",
];

/** רשימת הגיבויים הקיימים */
export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "admin");
  if ("error" in res) return res.error;

  if (storage.kind() === "local-disk") {
    const dir = path.join(process.cwd(), "data", "backups");
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const backups = entries
      .filter((e) => e.isDirectory() && e.name.startsWith("backup-"))
      .map((e) => e.name)
      .sort()
      .reverse();
    return json({ backups, mode: storage.kind() });
  }

  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: "cortez-ops/backups/" });
  const names = new Set(
    blobs
      .map((b) => b.pathname.split("/")[2])
      .filter((n): n is string => Boolean(n) && n.startsWith("backup-"))
  );
  return json({ backups: Array.from(names).sort().reverse(), mode: storage.kind() });
});

/** גיבוי ידני — רשומות (+ העלאות באחסון מקומי) לתיקיית חותמת זמן */
export const POST = route(async (req: NextRequest) => {
  const res = await requireArea(req, "admin");
  if ("error" in res) return res.error;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backed = await storage.backup(COLLECTIONS, stamp);
  return json({ backup: `backup-${stamp}`, collections: backed.length, mode: storage.kind() }, 201);
});
