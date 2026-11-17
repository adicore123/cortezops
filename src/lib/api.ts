import { NextResponse, NextRequest } from "next/server";
import { ensureInit } from "./db/init";

/** עוטף handler: מאתחל DB, תופס שגיאות ומחזיר JSON אחיד. */
export function route<Ctx = unknown>(
  handler: (req: NextRequest, ctx: Ctx) => Promise<NextResponse | Response>
) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse | Response> => {
    try {
      await ensureInit();
      return await handler(req, ctx);
    } catch (err) {
      console.error("[api]", err);
      const message = err instanceof Error ? err.message : "שגיאת שרת פנימית";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

/** סטרינג ריק → undefined (שדות טופס ריקים לא יישמרו כמחרוזות ריקות) */
export function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}
