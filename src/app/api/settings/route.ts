import { NextRequest } from "next/server";
import { route, json, body } from "@/lib/api";
import { readCollection, writeCollection } from "@/lib/db/store";
import { requireUser, requireArea } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import type { Settings, StoredFile } from "@/lib/types";

export const GET = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  return json({ settings: await getSettings() });
});

/** עדכון הגדרות — מנהל בלבד. */
export const PATCH = route(async (req: NextRequest) => {
  const res = await requireArea(req, "admin");
  if ("error" in res) return res.error;

  const data = await body<{
    importer?: Partial<Settings["importer"]>;
    toolCategories?: string[];
    partCategories?: string[];
    defectCategories?: string[];
    lowStockThreshold?: number;
  }>(req);

  const current = await getSettings();
  // סף מלאי נמוך: מספר שלם תקין בין 0 ל־999, אחרת ברירת המחדל
  const rawThreshold = data.lowStockThreshold;
  const threshold =
    rawThreshold === undefined
      ? current.lowStockThreshold
      : Number.isInteger(rawThreshold) && rawThreshold >= 0 && rawThreshold <= 999
        ? rawThreshold
        : 3;

  const next: Settings = {
    importer: {
      ...current.importer,
      ...(data.importer ?? {}),
      // ולידציה של לוגו — חייב להיות קובץ קיים
      logoFileId: await validFile(data.importer?.logoFileId, current.importer.logoFileId),
    },
    toolCategories: data.toolCategories ?? current.toolCategories,
    partCategories: data.partCategories ?? current.partCategories,
    defectCategories: data.defectCategories ?? current.defectCategories,
    lowStockThreshold: threshold,
  };

  const rows = await readCollection<Settings>("settings");
  if (rows.length === 0) await writeCollection<Settings>("settings", () => [next]);
  else await writeCollection<Settings>("settings", (items) => items.map((s, i) => (i === 0 ? next : s)));

  return json({ settings: next });
});

async function validFile(newId?: string, current?: string): Promise<string | undefined> {
  if (newId === undefined) return current; // לא סופק — שינוי לא נוגע ללוגו
  if (newId === "") return undefined; // איפוס מפורש ללוגו ברירת מחדל
  const files = await readCollection<StoredFile>("files");
  return files.some((f) => f.id === newId) ? newId : current;
}
