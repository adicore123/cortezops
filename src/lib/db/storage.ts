import { promises as fs } from "fs";
import path from "path";

/**
 * אדפטר אחסון כפול:
 * - מקומי (ברירת מחדל, בלי BLOB_READ_WRITE_TOKEN): קובצי JSON ב־data/ + uploads
 *   בדיסק. כתיבה אטומית (tmp+rename), מופע שרת יחיד.
 * - Vercel Blob: אחסון פרטי עמיד לריבוי מופעים. כתיבות read-modify-write
 *   מוגנות בנעילה מבוזרת (blob נעילה עם TTL) כדי שמופעי פונקציות שונים
 *   לא ידרסו זה את כתיבותיו של זה.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const BLOB_PREFIX = "cortez-ops";
const LOCK_TTL_MS = 10_000; // נעילה תקועה נגנבת אחרי 10 שניות
const LOCK_WAIT_MS = 5_000;

/**
 * מצב Blob פעיל רק על Vercel (משתנה VERCEL מוזרק אוטומטית), או בהפעלה
 * מפורשת לניפוי שגיאות (CZ_USE_BLOB=1). בכך נמנעת כתיבה מקומית בשוגג
 * למאגר הענן רק משום ש-.env.local מכיל את הטוקן.
 */
export const isVercel =
  Boolean(process.env.BLOB_READ_WRITE_TOKEN) &&
  (process.env.VERCEL === "1" || process.env.CZ_USE_BLOB === "1");

/**
 * בחירת אדפטר בזמן קריאה (לא בטעינת מודול): מבטיחה שכל הנתיבים יראו
 * את אותה סביבה גם אם מודולים אותחלו בשלבים שונים של הבנייה/הריצה.
 */
export function storageFor(): StorageAdapter {
  const blobActive =
    Boolean(process.env.BLOB_READ_WRITE_TOKEN) &&
    (process.env.VERCEL === "1" || process.env.CZ_USE_BLOB === "1");
  return blobActive ? vercelBlob : local;
}

/** צור/קרא אדפטר דרך Proxy — שקיפות מלאה לקוד הקיים */
export const storage: StorageAdapter = new Proxy({} as StorageAdapter, {
  get(_t, prop: keyof StorageAdapter) {
    return storageFor()[prop];
  },
});

export interface StorageAdapter {
  readRaw(name: string): Promise<string | null>;
  /** כתיבה רגילה (ממוגנת בנעילה ב־Blob) */
  writeRaw(name: string, content: string): Promise<void>;
  /** כתיבה רק אם האוסף עדיין לא קיים — מחזיר false אם כבר קיים */
  writeRawIfAbsent(name: string, content: string): Promise<boolean>;
  /** קובץ העלאה בינארי */
  saveUpload(id: string, data: Buffer): Promise<void>;
  readUpload(id: string): Promise<Buffer | null>;
  /** כתובת הורדה חתומה (Blob) או null באחסון מקומי */
  uploadDownloadUrl(id: string): Promise<string | null>;
  /** הרצת read-modify-write תחת נעילה מבוזרת (no-op מקומית) */
  withLock<T>(name: string, fn: () => Promise<T>): Promise<T>;
  /** גיבוי אוספים לתיקיית חותמת זמן. מחזיר רשימת שמות שגובו. */
  backup(names: string[], stamp: string): Promise<string[]>;
  kind(): "local-disk" | "vercel-blob";
}

// ─── אדפטר מקומי ─────────────────────────────────────────────────────────────

const local: StorageAdapter = {
  async readRaw(name) {
    try {
      return await fs.readFile(path.join(DATA_DIR, `${name}.json`), "utf-8");
    } catch {
      return null;
    }
  },
  async writeRaw(name, content) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const target = path.join(DATA_DIR, `${name}.json`);
    const tmp = path.join(DATA_DIR, `.tmp-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.writeFile(tmp, content, "utf-8");
    await fs.rename(tmp, target); // אטומי באותו כונן
  },
  async writeRawIfAbsent(name, content) {
    if (await this.readRaw(name)) return false;
    await this.writeRaw(name, content);
    return true;
  },
  async saveUpload(id, data) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOADS_DIR, id), data);
  },
  async readUpload(id) {
    try {
      return await fs.readFile(path.join(UPLOADS_DIR, id));
    } catch {
      return null;
    }
  },
  async uploadDownloadUrl() {
    return null;
  },
  async withLock(_name, fn) {
    return fn();
  },
  async backup(names, stamp) {
    const backed: string[] = [];
    const dir = path.join(DATA_DIR, "backups", `backup-${stamp}`);
    await fs.mkdir(dir, { recursive: true });
    for (const name of names) {
      const raw = await this.readRaw(name);
      if (raw === null) continue;
      await fs.writeFile(path.join(dir, `${name}.json`), raw, "utf-8");
      backed.push(name);
    }
    // העלאות מקומיות מועתקות יחד עם הרשומות
    try {
      await fs.cp(UPLOADS_DIR, path.join(dir, "uploads"), { recursive: true });
    } catch { /* אין העלאות */ }
    return backed;
  },
  kind() {
    return "local-disk";
  },
};

// ─── אדפטר Vercel Blob ──────────────────────────────────────────────────────

const collectionPath = (name: string) => `${BLOB_PREFIX}/collections/${name}.json`;
const uploadPath = (id: string) => `${BLOB_PREFIX}/uploads/${id}`;
const lockPath = (name: string) => `${BLOB_PREFIX}/locks/${name}.lock`;

async function blobPut(pathname: string, body: string | Buffer, allowOverwrite: boolean) {
  const { put } = await import("@vercel/blob");
  if (process.env.DEBUG_BLOB) console.log(`[blob] put ${pathname} (${body.length}b, ow=${allowOverwrite})`);
  await put(pathname, body, {
    access: "private",
    allowOverwrite,
    addRandomSuffix: false,
    // קריטי: ברירת המחדל היא שנה של מטמון CDN — קריאות מהפונקציות היו מקבלות גרסה ישנה
    cacheControlMaxAge: 0,
    ...(typeof body === "string" ? { contentType: "application/json" } : {}),
  });
}

/** קריאת תוכן דרך ה־API של Blob (עוקף את מטמון ה־CDN) */
async function blobGetText(pathname: string): Promise<string | null> {
  const { get } = await import("@vercel/blob");
  const result = await get(pathname, { access: "private" });
  if (!result) return null;
  return await new Response(result.stream).text();
}

async function blobGetBuffer(pathname: string): Promise<Buffer | null> {
  const { get } = await import("@vercel/blob");
  const result = await get(pathname, { access: "private" });
  if (!result) return null;
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

const vercelBlob: StorageAdapter = {
  async readRaw(name) {
    try {
      const t = await blobGetText(collectionPath(name));
      if (process.env.DEBUG_BLOB) console.log(`[blob] read ${name} → ${t?.length ?? "null"} bytes`);
      return t;
    } catch (e) {
      if (process.env.DEBUG_BLOB) console.log(`[blob] read ${name} THREW: ${e instanceof Error ? e.message : e}`);
      return null;
    }
  },

  async writeRaw(name, content) {
    // כתיבה ישירה — הנעילה מנוהלת בשכבת האוסף (store.writeCollection)
    await blobPut(collectionPath(name), content, true);
  },

  async writeRawIfAbsent(name, content) {
    try {
      await blobPut(collectionPath(name), content, false); // allowOverwrite:false = נכתב רק אם לא קיים
      return true;
    } catch (err) {
      // "already exists" = מישהו כבר כתב — לא שגיאה
      if (err instanceof Error && err.message.includes("already exists")) return false;
      throw err;
    }
  },

  async saveUpload(id, data) {
    await blobPut(uploadPath(id), data, true);
  },

  async readUpload(id) {
    try {
      return await blobGetBuffer(uploadPath(id));
    } catch {
      return null;
    }
  },

  async uploadDownloadUrl() {
    // ב־Blob פרטי אין הפניה לדפדפן — הקבצים מוזרמים דרך /api/files עם בדיקת הרשאה
    return null;
  },

  async withLock(name, fn) {
    const { head, del } = await import("@vercel/blob");
    if (process.env.DEBUG_BLOB) console.log(`[blob] withLock(${name}) start`);
    const lock = lockPath(name);
    const deadline = Date.now() + LOCK_WAIT_MS;

    // ניסיון רכישה עם גניבת נעילות ישנות
    while (Date.now() < deadline) {
      try {
        await blobPut(lock, new Date().toISOString(), false);
        break; // נרכשה
      } catch {
        // תפוסה — אם ישנה מ־TTL, גונבים אותה
        try {
          const info = await head(lock);
          if (info && Date.now() - info.uploadedAt.getTime() > LOCK_TTL_MS) {
            await blobPut(lock, new Date().toISOString(), true); // גניבה
            break;
          }
        } catch { /* נעילה נמחקה בינתיים */ }
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    try {
      return await fn();
    } finally {
      await del(lock).catch(() => undefined);
    }
  },

  async backup(names, stamp) {
    // ב־Blob: ההעלאות כבר עמידות בפני עצמן — הגיבוי מכסה את רשומות ה־JSON
    const backed: string[] = [];
    for (const name of names) {
      const raw = await this.readRaw(name);
      if (raw === null) continue;
      await blobPut(`${BLOB_PREFIX}/backups/backup-${stamp}/${name}.json`, raw, true);
      backed.push(name);
    }
    return backed;
  },

  kind() {
    return "vercel-blob";
  },
};
