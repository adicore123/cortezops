import { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { requireUser, canAccess } from "@/lib/auth";
import { readCollection } from "@/lib/db/store";
import type { ToolModel, InspectionCase, Defect, Part, ServiceCall, CaseDocument } from "@/lib/types";

// ─── חיפוש גלובלי ────────────────────────────────────────────────────────────
// חיפוש חוצה־קולקציות עם סינון הרשאות: סוכן רואה רק קריאות שירות משלו,
// ותיקים/חלפים מוצגים רק למי שיש לו הרשאת אזור מתאימה.

export interface SearchItem {
  id: string;
  title: string;
  sub?: string;
  href: string;
}

export interface SearchGroup {
  key: string;
  label: string;
  items: SearchItem[];
}

const PER_GROUP = 6;

/** נירמול להשוואה: אותיות קטנות + הסרת גרש/גרשיים (מק"ט / מק״ט) */
function norm(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().replace(/["'׳״]/g, " ");
}

export const GET = route(async (req: NextRequest) => {
  const res = await requireUser(req);
  if ("error" in res) return res.error;
  const user = res.user;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json({ groups: [] as SearchGroup[] });
  const needle = norm(q);
  const hit = (...fields: (string | undefined | null)[]): boolean =>
    fields.some((f) => norm(f).includes(needle));

  const groups: SearchGroup[] = [];
  const push = (key: string, label: string, items: SearchItem[]) => {
    if (items.length > 0) groups.push({ key, label, items: items.slice(0, PER_GROUP) });
  };

  // ─── דגמים — גלויים לכל מחובר ────────────────────────────────────────────
  const models = await readCollection<ToolModel>("models");
  const modelItems: SearchItem[] = [];
  for (const m of models) {
    if (m.archived) continue;
    if (hit(m.commercialName, m.manufacturerCode, m.manufacturer, m.category)) {
      modelItems.push({
        id: m.id,
        title: m.commercialName,
        sub: [m.category, m.manufacturerCode].filter(Boolean).join(" · "),
        href: `/models/${m.id}`,
      });
    }
  }
  push("models", "דגמים", modelItems);

  // ─── תיקי מכון, ליקויים ומסמכים — לבעלי הרשאת cases ─────────────────────
  if (canAccess(user, "cases")) {
    const [cases, defects, documents] = await Promise.all([
      readCollection<InspectionCase>("cases"),
      readCollection<Defect>("defects"),
      readCollection<CaseDocument>("documents"),
    ]);

    const caseItems: SearchItem[] = [];
    for (const c of cases) {
      if (
        hit(
          c.caseNumber,
          c.sampleId,
          c.owner,
          c.order?.customer,
          c.order?.waybill,
          c.order?.supplier,
          c.inspection?.certificateNo,
          c.inspection?.standardNo,
          c.inspection?.labSampleNo
        )
      ) {
        caseItems.push({
          id: c.id,
          title: `תיק ${c.caseNumber}`,
          sub: [c.sampleId, c.order?.customer].filter(Boolean).join(" · ") || undefined,
          href: `/cases/${c.id}`,
        });
      }
    }
    push("cases", "תיקי מכון", caseItems);

    const caseById = new Map(cases.map((c) => [c.id, c]));
    const defectItems: SearchItem[] = [];
    for (const d of defects) {
      if (hit(d.title, d.category, d.asReceived, d.certificateSection, d.sticker?.requiredText)) {
        const c = caseById.get(d.caseId);
        defectItems.push({
          id: d.id,
          title: d.title,
          sub: c ? `תיק ${c.caseNumber}` : undefined,
          href: c ? `/cases/${c.id}?tab=defects` : "/defects",
        });
      }
    }
    push("defects", "ליקויים", defectItems);

    const docItems: SearchItem[] = [];
    for (const doc of documents) {
      if (hit(doc.originalName, doc.title, doc.note, doc.uploadedBy)) {
        const c = caseById.get(doc.caseId);
        docItems.push({
          id: doc.id,
          title: doc.title || doc.originalName,
          sub: c ? `תיק ${c.caseNumber}` : undefined,
          href: c ? `/cases/${c.id}?tab=documents` : "/cases",
        });
      }
    }
    push("documents", "מסמכים", docItems);
  }

  // ─── מלאי חלפים — לבעלי הרשאת inventory ──────────────────────────────────
  if (canAccess(user, "inventory")) {
    const parts = await readCollection<Part>("parts");
    const partItems: SearchItem[] = [];
    for (const p of parts) {
      if (hit(p.sku, p.name, p.partModel, p.manufacturer, p.category)) {
        partItems.push({
          id: p.id,
          title: p.name,
          sub: [p.sku, p.category].filter(Boolean).join(" · "),
          href: `/parts?q=${encodeURIComponent(p.sku)}`,
        });
      }
    }
    push("parts", "מלאי חלפים", partItems);
  }

  // ─── קריאות שירות — לכולם; סוכן רואה רק את שלו ───────────────────────────
  const calls = await readCollection<ServiceCall>("serviceCalls");
  const callItems: SearchItem[] = [];
  for (const call of calls) {
    if (user.role === "agent" && call.agentId !== user.id) continue;
    if (hit(call.callNumber, call.frameNumber, call.agentName, call.contactName, call.contactPhone, call.description)) {
      callItems.push({
        id: call.id,
        title: `קריאה ${call.callNumber}`,
        sub: [call.frameNumber, call.contactName].filter(Boolean).join(" · ") || call.agentName,
        href: `/service/${call.id}`,
      });
    }
  }
  push("service", "קריאות שירות", callItems);

  return json({ groups });
});
