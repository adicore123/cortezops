import Link from "next/link";
import { getUserServer, canAccess } from "@/lib/auth";
import { readCollection, ensureInitSafe } from "@/lib/dashboard-helpers";
import { getSettings } from "@/lib/settings";
import { Badge, Stat } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { CALL_STATUS_LABELS, CASE_STATUS_LABELS, DEFECT_STATUS_LABELS } from "@/lib/types";
import type { InspectionCase, Defect, ServiceCall, ToolModel, Notification, Part } from "@/lib/types";

interface ActionItem {
  title: string;
  sub?: string;
  href: string;
  tone: "red" | "amber" | "purple";
}

export default async function DashboardPage() {
  await ensureInitSafe();
  const user = await getUserServer();
  if (!user) return null;

  const [cases, defects, calls, models, notes, parts, settings] = await Promise.all([
    readCollection<InspectionCase>("cases"),
    readCollection<Defect>("defects"),
    readCollection<ServiceCall>("serviceCalls"),
    readCollection<ToolModel>("models"),
    readCollection<Notification>("notifications"),
    readCollection<Part>("parts"),
    getSettings(),
  ]);

  const canCases = canAccess(user, "cases");
  const canInventory = canAccess(user, "inventory");
  const modelName = (id: string) => models.find((m) => m.id === id)?.commercialName ?? "—";
  const caseById = new Map(cases.map((c) => [c.id, c]));

  // תיקים בטיפול (לא הושלמו)
  const activeCases = cases
    .filter((c) => c.status !== "completed" && c.status !== "draft")
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  // ליקויים שממתינים לאימות
  const awaiting = defects.filter((d) => d.status === "awaitingVerification");

  // פריטים חסרים בתיקים פעילים
  const casesWithMissing = cases
    .filter((c) => c.status !== "completed")
    .map((c) => ({ c, missing: c.checklist.filter((i) => !i.done) }))
    .filter((x) => x.missing.length > 0);

  // קריאות שירות — סוכן רואה את שלו בלבד
  const myCalls = calls
    .filter((c) => (user.role === "agent" ? c.agentId === user.id : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const newCalls = myCalls.filter((c) => c.status === "new");
  const openCalls = myCalls.filter((c) => c.status === "new" || c.status === "inProgress" || c.status === "awaitingPart");

  // חוסרים במלאי + דגמים הממתינים לאישור
  const threshold = settings.lowStockThreshold ?? 3;
  const lowStock = parts.filter((p) => p.qty <= threshold).sort((a, b) => a.qty - b.qty);
  const pendingModels = canCases ? models.filter((m) => !m.archived && m.approval.status === "pending") : [];

  // ─── מרכז הפעולות: דורש טיפול ────────────────────────────────────────────
  const actions: ActionItem[] = [
    ...awaiting.slice(0, 3).map((d) => ({
      title: `ליקוי: ${d.title}`,
      sub: `ממתין לאימות · תיק ${caseById.get(d.caseId)?.caseNumber ?? "—"}`,
      href: `/cases/${d.caseId}?tab=defects`,
      tone: "purple" as const,
    })),
    ...newCalls.slice(0, 2).map((c) => ({
      title: `קריאה ${c.callNumber}`,
      sub: `${modelName(c.modelId ?? "")} · חדשה — ממתינה לטיפול`,
      href: `/service/${c.id}`,
      tone: "red" as const,
    })),
    ...casesWithMissing.slice(0, 2).map(({ c, missing }) => ({
      title: `תיק ${c.caseNumber} — השלמות חסרות`,
      sub: missing.map((m) => m.label).join(" · "),
      href: `/cases/${c.id}`,
      tone: "amber" as const,
    })),
    ...lowStock.slice(0, 2).map((p) => ({
      title: `${p.name} — מלאי נמוך`,
      sub: `${p.qty} יחידות במלאי · ${p.sku}`,
      href: `/parts?q=${encodeURIComponent(p.sku)}`,
      tone: "amber" as const,
    })),
    ...pendingModels.slice(0, 2).map((m) => ({
      title: `${m.commercialName} — ממתין לאישור`,
      sub: "אישור פנימי של הדגם",
      href: `/models/${m.id}`,
      tone: "red" as const,
    })),
  ].slice(0, 8);

  const myNotes = notes
    .filter((n) => n.audience.includes(user.role) && !n.readBy.includes(user.id))
    .slice(0, 3);

  return (
    <div>
      {/* כותרת — 01 / OVERVIEW */}
      <div className="mb-6">
        <div className="num mb-1.5 text-xs font-bold tracking-widest text-cz-red">01 / OVERVIEW</div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">מרכז התפעול</h1>
        <p className="mt-1 text-sm text-cz-mut">
          מצב עדכני של בדיקות, שירות, חלפים ודגמים · שלום, {user.name}
        </p>
      </div>

      {/* ארבעה מדדים */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {canCases && <Stat label="תיקים בטיפול" value={activeCases.length} tone="red" href="/cases" />}
        {canCases && <Stat label="ליקויים לאימות" value={awaiting.length} tone="purple" href="/defects?status=awaitingVerification" />}
        <Stat label="קריאות שירות חדשות" value={newCalls.length} tone="green" href="/service" />
        {canInventory && <Stat label="חוסרים במלאי" value={lowStock.length} tone="amber" href="/parts" />}
      </div>

      {/* דורש טיפול */}
      {actions.length > 0 ? (
        <section className="card mb-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-cz-line-soft px-5 py-4">
            <h2 className="font-display text-lg font-extrabold">דורש טיפול</h2>
            <span className="num rounded-full bg-cz-red px-2.5 py-0.5 text-xs font-bold text-white">{actions.length}</span>
          </div>
          <ul className="divide-y divide-cz-line-soft">
            {actions.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-cz-bg">
                  <span className={`size-2 shrink-0 rounded-full ${a.tone === "red" ? "bg-cz-red" : a.tone === "amber" ? "bg-amber-500" : "bg-violet-600"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{a.title}</span>
                    {a.sub && <span className="block truncate text-xs text-cz-mut">{a.sub}</span>}
                  </span>
                  <span className="shrink-0 text-sm text-cz-fog" aria-hidden>→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="card mb-6 p-5 text-center text-sm text-cz-fog">הכול מטופל — אין פריטים הדורשים פעולה 🎉</div>
      )}

      {/* התראות אחרונות */}
      {myNotes.length > 0 && (
        <div className="card mb-6 border-s-4 border-s-cz-red p-4">
          <div className="mb-2 text-sm font-extrabold">התראות אחרונות</div>
          <ul className="space-y-1.5">
            {myNotes.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "#"} className="text-sm font-semibold hover:text-cz-red">• {n.message}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* תיקים בטיפול */}
        {canCases && (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">02 / תיקי מכון — בטיפול</h2>
              <Link href="/cases" className="text-sm font-bold text-cz-red hover:underline">כל התיקים →</Link>
            </div>
            {activeCases.length === 0 ? (
              <p className="py-4 text-center text-sm text-cz-fog">אין תיקים פעילים 🎉</p>
            ) : (
              <ul className="divide-y divide-cz-line-soft">
                {activeCases.slice(0, 5).map((c) => {
                  const open = defects.filter((d) => d.caseId === c.id && d.status !== "verified").length;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <Link href={`/cases/${c.id}`} className="font-bold hover:text-cz-red">
                          <span className="num">{c.caseNumber}</span> · {modelName(c.modelId)}
                        </Link>
                        {c.nextAction && <div className="truncate text-xs text-cz-mut">הבא: {c.nextAction}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {open > 0 && <Badge tone="red">{open} ליקויים</Badge>}
                        <Badge tone={c.status === "awaitingInstitute" ? "purple" : "blue"}>{CASE_STATUS_LABELS[c.status]}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* ליקויים ממתינים לאימות */}
        {canCases && (
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold">03 / ממתין לאימות</h2>
              <Link href="/defects" className="text-sm font-bold text-cz-red hover:underline">כל הליקויים →</Link>
            </div>
            {awaiting.length === 0 ? (
              <p className="py-4 text-center text-sm text-cz-fog">אין ליקויים הממתינים לאימות</p>
            ) : (
              <ul className="divide-y divide-cz-line-soft">
                {awaiting.slice(0, 5).map((d) => {
                  const c = cases.find((x) => x.id === d.caseId);
                  return (
                    <li key={d.id} className="py-2.5">
                      <Link href={`/cases/${d.caseId}?tab=defects`} className="font-bold hover:text-cz-red">
                        {d.title} <span className="text-xs font-normal text-cz-mut">({d.category})</span>
                      </Link>
                      <div className="text-xs text-cz-fog">
                        {c?.caseNumber} · {c && modelName(c.modelId)} · {DEFECT_STATUS_LABELS[d.status]}
                        {d.needsRecheck && " · נדרשת בדיקה חוזרת"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* פריטים חסרים */}
        {canCases && (
          <section className="card p-5">
            <h2 className="mb-3 font-display text-lg font-extrabold">04 / השלמות חסרות</h2>
            {casesWithMissing.length === 0 ? (
              <p className="py-4 text-center text-sm text-cz-fog">הכול הושלם</p>
            ) : (
              <ul className="divide-y divide-cz-line-soft">
                {casesWithMissing.slice(0, 5).map(({ c, missing }) => (
                  <li key={c.id} className="py-2.5">
                    <Link href={`/cases/${c.id}`} className="font-bold hover:text-cz-red">
                      <span className="num">{c.caseNumber}</span> · {modelName(c.modelId)}
                    </Link>
                    <div className="text-xs text-amber-700">חסר: {missing.map((m) => m.label).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* קריאות שירות */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">05 / קריאות שירות פתוחות</h2>
            <Link href="/service" className="text-sm font-bold text-cz-red hover:underline">כל הקריאות →</Link>
          </div>
          {openCalls.length === 0 ? (
            <p className="py-4 text-center text-sm text-cz-fog">אין קריאות פתוחות</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft">
              {openCalls.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/service/${c.id}`} className="font-bold hover:text-cz-red">
                      <span className="num">{c.callNumber}</span> · {modelName(c.modelId ?? "")}
                    </Link>
                    <div className="truncate text-xs text-cz-mut">{c.agentName} · {fmtDate(c.createdAt)}</div>
                  </div>
                  <Badge tone={c.status === "new" ? "red" : "amber"}>{CALL_STATUS_LABELS[c.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
