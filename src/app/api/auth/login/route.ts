import { NextRequest, NextResponse } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection } from "@/lib/db/store";
import { verifyPassword, createSession, sessionCookie, publicUser } from "@/lib/auth";
import type { User } from "@/lib/types";

export const POST = route(async (req: NextRequest) => {
  const { username, password } = await body<{ username?: string; password?: string }>(req);
  if (!username || !password) return bad("נא למלא שם משתמש וסיסמה");

  const users = await readCollection<User>("users");
  const user = users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase()
  );
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return bad("שם משתמש או סיסמה שגויים", 401);
  }
  if (!user.active) return bad("החשבון מושהה — פנה למנהל המערכת", 403);

  const token = await createSession(user.id).catch((err: unknown) => {
    throw new Error(`createSession failed: ${err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err)}`);
  });
  const res = json({ user: publicUser(user) });
  res.cookies.set(sessionCookie(token));
  return res;
});
