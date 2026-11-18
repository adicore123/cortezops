import crypto from "crypto";
import { storage } from "./storage";

// ─── מנוע אחסון JSON ──────────────────────────────────────────────────────────
// שכבת אוספים מעל אדפטר האחסון (דיסק מקומי או Vercel Blob).
// כל כתיבה מבוצעת תחת נעילה (מקומית: תור promise; Blob: נעילה מבוזרת)
// כדי לשמור על עדכונים מקביליים.

export function newId(): string {
  return crypto.randomUUID();
}

interface CollectionState {
  queue: Promise<unknown>;
}

const collections = new Map<string, CollectionState>();

// ─── Read-your-writes ────────────────────────────────────────────────────────
// לאחסון מבוזר (Vercel Blob) יש חלון אי־עקביות קצר בין כתיבה לקריאה.
// מטמון כתיבות אחרונות לכל אוסף מבטיח שמופע שכתב זה עתה יראה את כתיבתו
// מיד (הבקשה הבאה מאותו משתמש מגיעה בדרך כלל לאותו מופע חם).
const recentWrites = new Map<string, { data: unknown[]; at: number }>();
const RECENT_TTL_MS = 10_000;

function state(name: string): CollectionState {
  let s = collections.get(name);
  if (!s) {
    s = { queue: Promise.resolve() };
    collections.set(name, s);
  }
  return s;
}

/** קריאת אוסף. מחזיר מערך — אין לשנות אותו ישירות. */
export async function readCollection<T>(name: string): Promise<T[]> {
  const recent = recentWrites.get(name);
  if (recent && Date.now() - recent.at < RECENT_TTL_MS) {
    return recent.data as T[];
  }
  const raw = await storage.readRaw(name);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

/**
 * כתיבה מסונכרנת: הפונקציה מקבלת את המערך הנוכחי ומחזירה מערך חדש.
 * read→mutate→write מבוצע תחת נעילה — הן בתהליך המקומי והן בין מופעים (Blob).
 */
export async function writeCollection<T>(
  name: string,
  mutator: (items: T[]) => T[]
): Promise<T[]> {
  const s = state(name);
  const job = s.queue.then(async () =>
    storage.withLock(name, async () => {
      const current = await readCollection<T>(name);
      const next = mutator([...current]);
      await storage.writeRaw(name, JSON.stringify(next, null, 2));
      recentWrites.set(name, { data: next, at: Date.now() });
      return next;
    })
  );
  // שמירת שרשרת התור גם אם המשימה נכשלה
  s.queue = job.catch(() => undefined);
  return job;
}

/** כתיבה רק אם האוסף ריק/לא קיים — להגנה מכפילת seed. */
export async function writeCollectionIfAbsent<T>(name: string, items: T[]): Promise<boolean> {
  return storage.writeRawIfAbsent(name, JSON.stringify(items, null, 2));
}

/** עדכון רשומה בודדת לפי מזהה. מחזיר את הרשומה המעודכנת או null. */
export async function updateById<T extends { id: string }>(
  name: string,
  id: string,
  patch: (item: T) => T
): Promise<T | null> {
  let updated: T | null = null;
  await writeCollection<T>(name, (items) =>
    items.map((it) => {
      if (it.id !== id) return it;
      updated = patch(it);
      return updated;
    })
  );
  return updated;
}

export async function getById<T extends { id: string }>(
  name: string,
  id: string
): Promise<T | null> {
  const items = await readCollection<T>(name);
  return items.find((it) => it.id === id) ?? null;
}

/** מספר עוקב פנימי בפורמט CR-2026-001 / SC-2026-001 / RP-2026-001 */
export async function nextNumber(
  name: string,
  prefix: "CR" | "SC" | "RP"
): Promise<string> {
  const year = new Date().getFullYear();
  const items = await readCollection<{ caseNumber?: string; callNumber?: string; repairNumber?: string }>(name);
  const key = prefix === "CR" ? "caseNumber" : prefix === "SC" ? "callNumber" : "repairNumber";
  const nums = items
    .map((it) => (it as Record<string, string | undefined>)[key] ?? "")
    .filter((n) => n.startsWith(`${prefix}-${year}-`))
    .map((n) => parseInt(n.split("-")[2] ?? "0", 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}
