import { redirect } from "next/navigation";
import { getUserServer, publicUser, canAccess } from "@/lib/auth";
import { getSettings, logoUrl } from "@/lib/settings";
import { readCollection } from "@/lib/db/store";
import Shell from "@/components/Shell";
import { ToastProvider } from "@/components/Toasts";
import type { Notification, Defect, Repair } from "@/lib/types";

// המעטפת תלויה בסשן — אין לבצע לה כל רינדור מוקדם (גם לא Shell חלקי)
export const dynamic = "force-dynamic";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await getUserServer();
  if (!user) redirect("/login");

  const [settings, allNotes, allDefects, allRepairs] = await Promise.all([
    getSettings(),
    readCollection<Notification>("notifications"),
    readCollection<Defect>("defects"),
    readCollection<Repair>("repairs"),
  ]);

  const openDefects = canAccess(user, "cases")
    ? allDefects.filter((d) => d.status !== "verified").length
    : 0;

  const activeRepairs = canAccess(user, "service")
    ? allRepairs.filter((r) => r.status !== "completed").length
    : 0;

  const notifications = allNotes
    .filter((n) => n.audience.includes(user.role))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30)
    .map((n) => ({
      id: n.id,
      message: n.message,
      link: n.link,
      createdAt: n.createdAt,
      read: n.readBy.includes(user.id),
    }));

  return (
    <ToastProvider>
      <Shell
        user={publicUser(user)}
        importerName={settings.importer.name}
        logoUrl={logoUrl(settings)}
        notifications={notifications}
        openDefects={openDefects}
        activeRepairs={activeRepairs}
      >
        {children}
      </Shell>
    </ToastProvider>
  );
}
