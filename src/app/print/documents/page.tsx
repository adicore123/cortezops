import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getUserServer, canAccess } from "@/lib/auth";
import { getSettings, logoUrl } from "@/lib/settings";
import { readCollection } from "@/lib/db/store";
import { ensureInit } from "@/lib/db/init";
import PrintControls from "@/components/PrintControls";
import { DOC_TYPE_LABELS } from "@/lib/types";
import type { CaseDocument, StoredFile } from "@/lib/types";

export const dynamic = "force-dynamic";

/** תצוגת הדפסה למסמכים שנבחרו — רק הקבצים שנבחרו מוצגים */
export default async function PrintDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  await connection();
  await ensureInit();
  const user = await getUserServer();
  if (!user) redirect("/login");
  if (!canAccess(user, "cases")) redirect("/");

  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const [docs, files, settings] = await Promise.all([
    readCollection<CaseDocument>("documents"),
    readCollection<StoredFile>("files"),
    getSettings(),
  ]);

  const selected = idList
    .map((id) => {
      const doc = docs.find((d) => d.id === id);
      if (!doc) return null;
      return { ...doc, file: files.find((f) => f.id === doc.fileId) ?? null };
    })
    .filter((x): x is CaseDocument & { file: StoredFile | null } => x !== null);

  if (selected.length === 0) {
    return <div className="py-16 text-center font-bold">לא נבחרו מסמכים להדפסה</div>;
  }

  return (
    <div className="text-black">
      <PrintControls info={`${selected.length} מסמכים נבחרו`} />

      {selected.map((doc, i) => (
        <section key={doc.id} className="mb-8 break-inside-avoid-page">
          <header className="mb-3 flex items-center justify-between border-b border-gray-300 pb-2">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl(settings)} alt="" className="h-7 w-auto" />
              <span className="font-bold">{doc.title}</span>
              <span className="text-xs text-gray-600">({DOC_TYPE_LABELS[doc.type]})</span>
            </div>
            <span className="text-xs text-gray-500">{i + 1} / {selected.length}</span>
          </header>
          {doc.file?.mime.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${doc.fileId}`} alt={doc.title} className="w-full" />
          ) : (
            <iframe src={`/api/files/${doc.fileId}`} className="h-[100vh] w-full border border-gray-300" title={doc.title} />
          )}
        </section>
      ))}
    </div>
  );
}
