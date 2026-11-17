"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiSend, uploadFile } from "@/lib/client";
import { Badge, Btn, Field, Modal, PageHeader, Spinner, fmtDate } from "@/components/ui";
import { useToast } from "@/components/Toasts";
import FileUploader from "@/components/FileUploader";
import type { Settings, Role, Permissions } from "@/lib/types";
import type { PublicUser } from "@/lib/auth";

const TABS = [
  { key: "importer", label: "יבואן ולוגו" },
  { key: "users", label: "משתמשים והרשאות" },
  { key: "categories", label: "קטגוריות ומלאי" },
  { key: "backup", label: "גיבוי" },
] as const;

const ROLE_LABELS: Record<Role, string> = { admin: "מנהל מערכת", staff: "צוות יבואן", agent: "סוכן" };

export default function SettingsPage() {
  const toast = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("importer");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setSettings((await apiGet<{ settings: Settings }>("/api/settings")).settings);
    } catch {
      toast.push("error", "טעינת ההגדרות נכשלה");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (!settings) return <div className="flex justify-center py-24"><Spinner className="size-8 text-cz-red" /></div>;

  async function saveSettings(next: Settings, message: string) {
    setBusy(true);
    try {
      const res = await apiSend<{ settings: Settings }>("/api/settings", "PATCH", next);
      setSettings(res.settings);
      toast.push("success", message);
      router.refresh(); // רענון הלוגו בסרגל
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="הגדרות" subtitle="פרטי היבואן, משתמשים, קטגוריות וגיבויים" />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-full border border-cz-line-soft bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold ${tab === t.key ? "bg-cz-ink text-white" : "text-cz-mut hover:bg-cz-bg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "importer" && (
        <ImporterTab settings={settings} busy={busy} onSave={saveSettings} />
      )}
      {tab === "users" && <UsersTab />}
      {tab === "categories" && (
        <CategoriesTab settings={settings} busy={busy} onSave={saveSettings} />
      )}
      {tab === "backup" && <BackupTab />}
    </div>
  );
}

// ─── יבואן ולוגו ─────────────────────────────────────────────────────────────

function ImporterTab({
  settings, busy, onSave,
}: {
  settings: Settings;
  busy: boolean;
  onSave: (s: Settings, msg: string) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    setForm({
      name: settings.importer.name ?? "",
      phone: settings.importer.phone ?? "",
      email: settings.importer.email ?? "",
      address: settings.importer.address ?? "",
    });
  }, [settings]);

  const logoUrl = settings.importer.logoFileId ? `/api/files/${settings.importer.logoFileId}` : "/brand/cortez.png";

  return (
    <div className="card space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="שם היבואן">
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="טלפון">
          <input className="field" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="אימייל">
          <input className="field" dir="ltr" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="כתובת">
          <input className="field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
      </div>

      <div>
        <div className="label">לוגו — מוצג בממשק ובסיכומי תיק להדפסה</div>
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-cz-line-soft bg-cz-asphalt p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="לוגו" className="h-12 w-auto" />
          <div className="flex-1">
            <FileUploader
              compact
              accept="image/*"
              hint="PNG/SVG שקוף מומלץ"
              onUploaded={async (file) => {
                setLogoUploading(true);
                try {
                  onSave({ ...settings, importer: { ...settings.importer, logoFileId: file.id } }, "הלוגו הוחלף ויוצג בכל המערכת");
                } finally {
                  setLogoUploading(false);
                }
              }}
              onError={(m) => toast.push("error", m)}
            />
            {logoUploading && <Spinner className="mt-2 size-4" />}
          </div>
          {settings.importer.logoFileId && (
            <Btn variant="outline" size="sm" onClick={() => onSave({ ...settings, importer: { ...settings.importer, logoFileId: "" } }, "חזרה ללוגו ברירת המחדל")}>
              איפוס לברירת מחדל
            </Btn>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Btn loading={busy} onClick={() => onSave({ ...settings, importer: { ...settings.importer, ...form } }, "פרטי היבואן נשמרו")}>
          שמירת פרטי יבואן
        </Btn>
      </div>
    </div>
  );
}

// ─── משתמשים ────────────────────────────────────────────────────────────────

function UsersTab() {
  const toast = useToast();
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers((await apiGet<{ users: PublicUser[] }>("/api/users")).users);
    } catch {
      toast.push("error", "טעינת המשתמשים נכשלה");
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (!users) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Btn onClick={() => setAddOpen(true)}>+ משתמש חדש</Btn>
      </div>
      {users.map((u) => (
        <div key={u.id} className="card flex flex-wrap items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-full bg-cz-ink font-bold text-white">{u.name.slice(0, 1)}</span>
          <div className="min-w-32 flex-1">
            <div className="font-bold">{u.name}</div>
            <div className="text-xs text-cz-mut" dir="ltr">{u.username}</div>
          </div>
          <Badge tone={u.role === "admin" ? "red" : u.role === "staff" ? "blue" : "gray"}>{ROLE_LABELS[u.role]}</Badge>
          {u.role === "staff" && (
            <div className="flex flex-wrap gap-1">
              {(["cases", "inventory", "service", "viewCosts"] as const).map((p) => (
                <span key={p} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${u.permissions[p] ? "bg-cz-green-soft text-cz-green" : "bg-cz-sand text-cz-fog line-through"}`}>
                  {{ cases: "תיקים", inventory: "מלאי", service: "שירות", viewCosts: "עלויות" }[p]}
                </span>
              ))}
            </div>
          )}
          {!u.active && <Badge tone="red">מושהה</Badge>}
          <div className="flex gap-1.5">
            <Btn size="sm" variant="outline" onClick={() => setEditing(u)}>עריכה</Btn>
          </div>
        </div>
      ))}

      {addOpen && <UserModal onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); load(); }} />}
      {editing && <UserModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }: { user?: PublicUser; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    username: user?.username ?? "",
    password: "",
    role: user?.role ?? ("staff" as Role),
    cases: user?.permissions.cases ?? true,
    inventory: user?.permissions.inventory ?? true,
    service: user?.permissions.service ?? true,
    viewCosts: user?.permissions.viewCosts ?? false,
    active: user?.active ?? true,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const permissions: Partial<Permissions> = {
        cases: form.cases, inventory: form.inventory, service: form.service, viewCosts: form.viewCosts,
      };
      if (user) {
        await apiSend("/api/users", "PATCH", {
          id: user.id, name: form.name, role: form.role, permissions, active: form.active,
          ...(form.password ? { password: form.password } : {}),
        });
        toast.push("success", "המשתמש עודכן");
      } else {
        await apiSend("/api/users", "POST", {
          name: form.name, username: form.username, password: form.password, role: form.role, permissions,
        });
        toast.push("success", "המשתמש נוסף");
      }
      onSaved();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={user ? `עריכת ${user.name}` : "משתמש חדש"}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="שם מלא">
          <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        {!user && (
          <Field label="שם משתמש">
            <input className="field" dir="ltr" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </Field>
        )}
        <Field label={user ? "סיסמה חדשה (ריק = ללא שינוי)" : "סיסמה"} hint="6 תווים לפחות">
          <input className="field" dir="ltr" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <Field label="תפקיד">
          <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        {form.role === "staff" && (
          <Field label="הרשאות">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-cz-bg p-3">
              {([["cases", "תיקים"], ["inventory", "מלאי"], ["service", "שירות"], ["viewCosts", "צפייה בעלות יבואן"]] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="size-5 accent-cz-red"
                    checked={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        )}
        {user && (
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="size-5 accent-cz-red" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            חשבון פעיל
          </label>
        )}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" type="button" onClick={onClose}>ביטול</Btn>
          <Btn type="submit" loading={busy}>שמירה</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ─── קטגוריות ───────────────────────────────────────────────────────────────

function CategoriesTab({ settings, busy, onSave }: { settings: Settings; busy: boolean; onSave: (s: Settings, msg: string) => void }) {
  const groups: { key: "toolCategories" | "partCategories" | "defectCategories"; label: string; hint: string }[] = [
    { key: "toolCategories", label: "קטגוריות כלים", hint: "למאגר הדגמים" },
    { key: "partCategories", label: "קטגוריות חלפים", hint: "למלאי החלפים" },
    { key: "defectCategories", label: "קטגוריות ליקויים", hint: "לתיקי מכון התקנים" },
  ];
  const [draft, setDraft] = useState<Settings>(settings);
  const [newVals, setNewVals] = useState<Record<string, string>>({});

  useEffect(() => setDraft(settings), [settings]);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key} className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display font-extrabold">{g.label}</h3>
              <div className="text-xs text-cz-fog">{g.hint}</div>
            </div>
            <span className="num text-sm font-bold text-cz-mut">{draft[g.key].length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {draft[g.key].map((c, i) => (
              <span key={c} className="flex items-center gap-1.5 rounded-full bg-cz-sand px-3 py-1.5 text-sm font-bold">
                {c}
                <button
                  onClick={() => setDraft({ ...draft, [g.key]: draft[g.key].filter((_, x) => x !== i) })}
                  className="text-cz-mut hover:text-cz-red"
                  aria-label={`הסרת ${c}`}
                >✕</button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="field flex-1"
              placeholder="קטגוריה חדשה"
              value={newVals[g.key] ?? ""}
              onChange={(e) => setNewVals({ ...newVals, [g.key]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newVals[g.key]?.trim()) {
                  setDraft({ ...draft, [g.key]: [...draft[g.key], newVals[g.key].trim()] });
                  setNewVals({ ...newVals, [g.key]: "" });
                }
              }}
            />
            <Btn
              variant="outline"
              onClick={() => {
                if (newVals[g.key]?.trim()) {
                  setDraft({ ...draft, [g.key]: [...draft[g.key], newVals[g.key].trim()] });
                  setNewVals({ ...newVals, [g.key]: "" });
                }
              }}
            >
              הוספה
            </Btn>
          </div>
        </div>
      ))}
      {/* סף מלאי נמוך */}
      <div className="card p-5">
        <h3 className="font-display font-extrabold">התראת מלאי נמוך</h3>
        <p className="mb-3 mt-1 text-xs text-cz-fog">חלק שכמותו נמוכה או שווה לסף יסומן בחיווי מלאי נמוך בלוח הבקרה ובמלאי</p>
        <label className="label" htmlFor="low-stock">סף יחידות</label>
        <input
          id="low-stock"
          type="number"
          min={0}
          max={999}
          className="field w-32"
          value={draft.lowStockThreshold ?? 3}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            setDraft({ ...draft, lowStockThreshold: Number.isNaN(v) ? undefined : v });
          }}
        />
      </div>
      <div className="flex justify-end">
        <Btn loading={busy} onClick={() => onSave(draft, "הקטגוריות וההגדרות נשמרו")}>שמירה</Btn>
      </div>
    </div>
  );
}

// ─── גיבוי ──────────────────────────────────────────────────────────────────

function BackupTab() {
  const toast = useToast();
  const [backups, setBackups] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setBackups((await apiGet<{ backups: string[] }>("/api/backup")).backups);
    } catch {
      setBackups([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createBackup() {
    setBusy(true);
    try {
      const res = await apiSend<{ backup: string }>("/api/backup", "POST");
      toast.push("success", `נוצר גיבוי ${res.backup} — כולל רשומות וקבצים`);
      load();
    } catch (err) {
      toast.push("error", err instanceof Error ? err.message : "הגיבוי נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h3 className="font-display font-extrabold">גיבוי נתונים</h3>
        <p className="mt-1 text-sm text-cz-mut">
          הגיבוי מעתיק את כל הרשומות והקבצים (כולל תעודות ותמונות) לתיקיית <span className="num" dir="ltr">data/backups</span> על השרת.
        </p>
      </div>
      <Btn onClick={createBackup} loading={busy}>צור גיבוי עכשיו</Btn>

      {backups !== null && (
        <div>
          <div className="label">גיבויים קיימים ({backups.length})</div>
          {backups.length === 0 ? (
            <p className="text-sm text-cz-fog">אין גיבויים עדיין</p>
          ) : (
            <ul className="divide-y divide-cz-line-soft rounded-2xl border border-cz-line-soft">
              {backups.map((b) => (
                <li key={b} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="num" dir="ltr">{b}</span>
                  <span className="text-xs text-cz-fog">
                    {fmtDate(b.replace("backup-", "").split("T")[0])}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
