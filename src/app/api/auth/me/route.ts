import { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { getUserFromRequest, publicUser } from "@/lib/auth";

export const GET = route(async (req: NextRequest) => {
  const user = await getUserFromRequest(req);
  if (!user) return json({ user: null }, 401);
  return json({ user: publicUser(user) });
});
