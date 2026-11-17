import { NextRequest, NextResponse } from "next/server";
import { route } from "@/lib/api";
import { destroySession, clearSessionCookie } from "@/lib/auth";

export const POST = route(async (req: NextRequest) => {
  const token = (req as NextRequest).cookies.get("cz_session")?.value;
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearSessionCookie());
  return res;
});
