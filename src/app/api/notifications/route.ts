import { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { readCollection } from "@/lib/db/store";
import { requireUser } from "@/lib/auth";
import type { Notification } from "@/lib/types";

export const GET = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  const all = await readCollection<Notification>("notifications");
  const mine = all
    .filter((n) => n.audience.includes(res.user.role))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30)
    .map((n) => ({
      id: n.id,
      message: n.message,
      link: n.link,
      createdAt: n.createdAt,
      read: n.readBy.includes(res.user.id),
    }));
  return json({ notifications: mine });
});
