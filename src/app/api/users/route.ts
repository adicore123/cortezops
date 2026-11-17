import { NextRequest } from "next/server";
import { route, json, bad, body } from "@/lib/api";
import { readCollection, writeCollection, newId, updateById } from "@/lib/db/store";
import { requireArea, hashPassword, publicUser } from "@/lib/auth";
import type { User, Role, Permissions } from "@/lib/types";

const DEFAULT_PERMS: Record<Role, Permissions> = {
  admin: { cases: true, inventory: true, service: true, viewCosts: true },
  staff: { cases: true, inventory: true, service: true, viewCosts: false },
  agent: { cases: false, inventory: false, service: true, viewCosts: false },
};

export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "admin");
  if ("error" in res) return res.error;
  const users = await readCollection<User>("users");
  return json({ users: users.map(publicUser) });
});

export const POST = route(async (req: NextRequest) => {
  const res = await requireArea(req, "admin");
  if ("error" in res) return res.error;

  const data = await body<{ name: string; username: string; password: string; role: Role; permissions?: Partial<Permissions> }>(req);
  if (!data.name?.trim() || !data.username?.trim()) return bad("נדרשים שם ושם משתמש");
  if (!data.password || data.password.length < 6) return bad("הסיסמה חייבת לכלול 6 תווים לפחות");

  const users = await readCollection<User>("users");
  if (users.some((u) => u.username.toLowerCase() === data.username.trim().toLowerCase())) {
    return bad("שם משתמש כבר תפוס");
  }

  const role = (["admin", "staff", "agent"].includes(data.role) ? data.role : "staff") as Role;
  const user: User = {
    id: newId(),
    name: data.name.trim(),
    username: data.username.trim(),
    passwordHash: hashPassword(data.password),
    role,
    permissions: { ...DEFAULT_PERMS[role], ...data.permissions },
    active: true,
    createdAt: new Date().toISOString(),
  };
  await writeCollection<User>("users", (items) => [...items, user]);
  return json({ user: publicUser(user) }, 201);
});

export const PATCH = route(async (req: NextRequest) => {
  const res = await requireArea(req, "admin");
  if ("error" in res) return res.error;

  const data = await body<{
    id: string;
    name?: string;
    password?: string;
    role?: Role;
    permissions?: Partial<Permissions>;
    active?: boolean;
  }>(req);
  if (!data.id) return bad("חסר מזהה משתמש");

  const users = await readCollection<User>("users");
  const target = users.find((u) => u.id === data.id);
  if (!target) return bad("משתמש לא נמצא", 404);
  if (target.id === res.user.id && data.active === false) return bad("לא ניתן להשהות את עצמך");

  const updated = await updateById<User>("users", data.id, (u) => ({
    ...u,
    name: data.name?.trim() || u.name,
    passwordHash: data.password && data.password.length >= 6 ? hashPassword(data.password) : u.passwordHash,
    role: data.role ?? u.role,
    permissions: data.permissions ? { ...u.permissions, ...data.permissions } : u.permissions,
    active: data.active ?? u.active,
  }));
  if (!updated) return bad("משתמש לא נמצא", 404);
  return json({ user: publicUser(updated) });
});
