import { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { writeCollection } from "@/lib/db/store";
import { requireUser } from "@/lib/auth";
import type { Notification } from "@/lib/types";

export const POST = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  const userId = res.user.id;
  await writeCollection<Notification>("notifications", (items) =>
    items.map((n) =>
      n.audience.includes(res.user.role) && !n.readBy.includes(userId)
        ? { ...n, readBy: [...n.readBy, userId] }
        : n
    )
  );
  return json({ ok: true });
});
