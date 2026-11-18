import { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { storage } from "@/lib/db/storage";
import { readCollection } from "@/lib/db/store";
import type { User } from "@/lib/types";

/** בדיקת תקינות + אבחון סביבת אחסון (פומבי, בלי נתונים רגישים) */
export const GET = route(async (_req: NextRequest) => {
  const users = await readCollection<User>("users");
  return json({
    ok: true,
    storage: storage.kind(),
    db: process.env.MONGODB_URI ? "mongodb-atlas" : "local",
    users: users.length,
  });
});
