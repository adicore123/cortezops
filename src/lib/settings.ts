import { readCollection } from "./db/store";
import type { Settings } from "./types";

const DEFAULTS: Settings = {
  importer: { name: "קורטז" },
  toolCategories: ["אופניים חשמליים", "קורקינטים חשמליים"],
  partCategories: ["סוללות", "מנועים", "צגים", "בקרים", "צמות ראשיות", "כפתורים וידיות גז"],
  defectCategories: ["מדבקה", "סימון", "תיוג", "אריזה", "תיעוד", "אחר"],
};

export async function getSettings(): Promise<Settings> {
  const rows = await readCollection<Settings>("settings");
  return { ...DEFAULTS, ...rows[0], importer: { ...DEFAULTS.importer, ...rows[0]?.importer } };
}

export function logoUrl(settings: Settings): string {
  return settings.importer.logoFileId ? `/api/files/${settings.importer.logoFileId}` : "/brand/cortez.png";
}
