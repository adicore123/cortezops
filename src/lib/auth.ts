import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { readCollection, writeCollection, getById, newId } from "./db/store";
import type { User, Session, Role, Permissions } from "./types";

const COOKIE_NAME = "cz_session";
const SESSION_DAYS = 14;

// ─── סיסמאות (scrypt מ־node:crypto, בלי תלויות חוץ) ─────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidate, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── סשנים חתומים חסרי־מצב ─────────────────────────────────────────────────
// בסביבת serverless מופעים שונים קוראים אחסון מבוזר עם חלון אי־עקביות,
// ולכן סשן שנשמר באחסון עלול שלא להיראות למופע אחר מיד אחרי התחברות.
// פתרון: הסשן כולו (userId + תפוגה) חתום ב־HMAC בתוך העוגייה — כל מופע
// מאמת מקומית בלי קריאת אחסון.

let cachedSecret: string | null = null;

async function getSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret;
  // עדיף סוד מסביבה — זהה בכל המופעים, בלי תלות באחסון
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret) {
    cachedSecret = envSecret;
    return envSecret;
  }
  // סוד אוטומטי: נוצר פעם אחת ונשמר באחסון (עמיד להפעלות מחדש)
  const { storage } = await import("./db/storage");
  let raw = await storage.readRaw("meta").catch(() => null);
  let secret = raw ? (JSON.parse(raw) as { sessionSecret?: string }).sessionSecret : undefined;
  if (!secret) {
    // יצירה חד־פעמית: הראשון שכותב קובע, השאר קוראים את שלו (עם ניסיונות חוזרים לספיגת אי־עקביות)
    const generated = crypto.randomBytes(32).toString("hex");
    const created = await storage
      .writeRawIfAbsent("meta", JSON.stringify({ sessionSecret: generated }, null, 2))
      .catch(() => false);
    if (created) {
      cachedSecret = generated;
      return generated;
    }
    for (let i = 0; i < 4 && !secret; i++) {
      await new Promise((r) => setTimeout(r, 250));
      raw = await storage.readRaw("meta").catch(() => null);
      secret = raw ? (JSON.parse(raw) as { sessionSecret?: string }).sessionSecret : undefined;
    }
    secret ??= generated;
  }
  cachedSecret = secret;
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

async function signToken(userId: string): Promise<string> {
  const secret = await getSecret();
  const payload = b64url(
    Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 }))
  );
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `v1.${payload}.${sig}`;
}

async function verifyToken(token: string | undefined): Promise<string | null> {
  if (!token?.startsWith("v1.")) return null;
  const [, payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const secret = await getSecret();
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; exp: number };
    if (!uid || typeof exp !== "number" || Date.now() > exp) return null;
    return uid;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  return signToken(userId);
}

/** אין צורך בהשמדה בצד השרת — העוגייה מנוקה בצד הלקוח */
export async function destroySession(_token: string) {
  /* no-op */
}

/** מאחזר משתמש לפי טוקן סשן חתום. מחזיר null אם לא תקין/פג תוקף. */
export async function getUserByToken(token: string | undefined): Promise<User | null> {
  const uid = await verifyToken(token);
  if (!uid) return null;
  const user = await getById<User>("users", uid);
  if (!user || !user.active) return null;
  return user;
}

/** מאחזר את המשתמש מתוך הבקשה (cookie). מחזיר null אם לא מחובר/פג תוקף. */
export async function getUserFromRequest(
  req: NextRequest
): Promise<User | null> {
  return getUserByToken(req.cookies.get(COOKIE_NAME)?.value);
}

/** מאחזר את המשתמש ברכיב שרת (Server Component) לפי cookies(). */
export async function getUserServer(): Promise<User | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return getUserByToken(store.get(COOKIE_NAME)?.value);
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function clearSessionCookie() {
  return { name: COOKIE_NAME, value: "", httpOnly: true, path: "/", maxAge: 0 };
}

// ─── בדיקות הרשאה בצד השרת ─────────────────────────────────────────────────

export function hasPermission(user: User, perm: keyof Permissions): boolean {
  if (user.role === "admin") return true;
  return Boolean(user.permissions?.[perm]);
}

export function canAccess(user: User, area: "cases" | "inventory" | "service" | "admin"): boolean {
  switch (area) {
    case "admin":
      return user.role === "admin";
    case "cases":
      return user.role === "admin" || (user.role === "staff" && hasPermission(user, "cases"));
    case "inventory":
      return user.role === "admin" || (user.role === "staff" && hasPermission(user, "inventory"));
    case "service":
      return user.role === "admin" || user.role === "staff" || user.role === "agent";
  }
}

/** מאשר גישה לנתיב API. מחזיר משתמש או NextResponse שגיאה. */
export async function requireUser(
  req: NextRequest
): Promise<{ user: User } | { error: NextResponse }> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return { error: NextResponse.json({ error: "נדרשת כניסה למערכת" }, { status: 401 }) };
  }
  return { user };
}

export async function requireArea(
  req: NextRequest,
  area: "cases" | "inventory" | "service" | "admin"
): Promise<{ user: User } | { error: NextResponse }> {
  const res = await requireUser(req);
  if ("error" in res) return res;
  if (!canAccess(res.user, area)) {
    return { error: NextResponse.json({ error: "אין הרשאה לפעולה זו" }, { status: 403 }) };
  }
  return res;
}

export function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    permissions: u.permissions,
    active: u.active,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;

export { newId };
