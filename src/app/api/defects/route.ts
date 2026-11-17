import { NextRequest } from "next/server";
import { route, json } from "@/lib/api";
import { readCollection } from "@/lib/db/store";
import { requireArea } from "@/lib/auth";
import type { Defect, InspectionCase, ToolModel } from "@/lib/types";

/** כל הליקויים של כל התיקים — לעמוד הניהול המרוכז. פילטרים ב־query. */
export const GET = route(async (req: NextRequest) => {
  const res = await requireArea(req, "cases");
  if ("error" in res) return res.error;

  const params = new URL(req.url).searchParams;
  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const owner = params.get("owner") ?? "";
  const modelId = params.get("modelId") ?? "";
  const q = (params.get("q") ?? "").trim().toLowerCase();

  const [defects, cases, models] = await Promise.all([
    readCollection<Defect>("defects"),
    readCollection<InspectionCase>("cases"),
    readCollection<ToolModel>("models"),
  ]);

  const modelName = (id: string) => models.find((m) => m.id === id)?.commercialName ?? "—";

  const rows = defects
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((d) => {
      const c = cases.find((x) => x.id === d.caseId);
      return {
        id: d.id,
        caseId: d.caseId,
        caseNumber: c?.caseNumber ?? "—",
        caseStatus: c?.status ?? "draft",
        modelId: c?.modelId ?? "",
        modelName: c ? modelName(c.modelId) : "—",
        category: d.category,
        title: d.title,
        owner: d.owner ?? "",
        dueDate: d.dueDate,
        status: d.status,
        needsRecheck: Boolean(d.needsRecheck),
        certificateSection: d.certificateSection ?? "",
        updatedAt: d.updatedAt,
        createdAt: d.createdAt,
      };
    })
    .filter((r) => {
      if (status && r.status !== status) return false;
      if (category && r.category !== category) return false;
      if (owner && r.owner !== owner) return false;
      if (modelId && r.modelId !== modelId) return false;
      if (q) {
        const hay = [r.title, r.caseNumber, r.modelName, r.owner, r.certificateSection]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

  return json({
    defects: rows,
    filters: {
      categories: Array.from(new Set(defects.map((d) => d.category).filter(Boolean))).sort(),
      owners: Array.from(new Set(defects.map((d) => d.owner).filter(Boolean) as string[])).sort(),
      models: models.filter((m) => !m.archived).map((m) => ({ id: m.id, name: m.commercialName })),
    },
  });
});
