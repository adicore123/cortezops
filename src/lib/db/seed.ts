import { newId, writeCollection, readCollection, writeCollectionIfAbsent } from "./store";
import { storage } from "./storage";
import { hashPassword } from "../auth";
import type {
  User, ToolModel, InspectionCase, Defect, CaseDocument, StoredFile,
  Part, PartMovement, ServiceCall, Repair, Notification, Settings,
} from "../types";

// ─── יצירת קובץ placeholder בעלייה ─────────────────────────────────────────

async function addFile(
  files: StoredFile[],
  uploads: { id: string; buf: Buffer }[],
  originalName: string,
  ext: string,
  mime: string,
  content: string | Buffer,
  uploadedBy: string
): Promise<StoredFile> {
  const id = newId();
  const f: StoredFile = {
    id,
    originalName,
    ext,
    mime,
    size: typeof content === "string" ? Buffer.byteLength(content) : content.length,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };
  files.push(f);
  uploads.push({ id, buf: typeof content === "string" ? Buffer.from(content, "utf-8") : content });
  return f;
}

function stickerSvg(title: string, lines: string[], bg = "#0A0A0C", fg = "#E6E6EA"): string {
  const body = lines
    .map((l, i) => `<text x="250" y="${150 + i * 46}" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="${fg}">${l}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="360" viewBox="0 0 500 360">
  <rect width="500" height="360" rx="24" fill="${bg}" stroke="${fg}" stroke-width="4"/>
  <text x="250" y="70" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="${fg}" opacity="0.7">${title}</text>
  ${body}
</svg>`;
}

/** PDF מינימלי תקין לדוגמה */
function samplePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const content = lines
    .map((l, i) => `BT /F1 ${i === 0 ? 20 : 13} Tf 60 ${760 - i * 30} Td (${esc(l)}) Tj ET`)
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

// ─── Seed ראשי ───────────────────────────────────────────────────────────────

export async function seedIfNeeded(): Promise<boolean> {
  const users = await readCollection<User>("users");
  if (users.length > 0) {
    // אם המערכת כבר אותחלה בעבר אך אוסף תיקונים עדיין לא נזרע — נזרע דוגמאות תיקונים
    const existingRepairs = await readCollection<Repair>("repairs");
    if (existingRepairs.length === 0) {
      const existingModels = await readCollection<ToolModel>("models");
      const existingParts = await readCollection<Part>("parts");
      await seedInitialRepairs(existingModels, existingParts);
    }
    return false;
  }

  // תפיסת נעילת seed: מופעי שרת שונים (serverless) לא יזרעו פעמיים
  const usersSeeded = await writeCollectionIfAbsent<User>("users", []);
  if (!usersSeeded) return false;

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));
  const daysAhead = (n: number) => iso(new Date(now.getTime() + n * 24 * 60 * 60 * 1000));

  const uploads: { id: string; buf: Buffer }[] = [];
  const files: StoredFile[] = [];

  // ── משתמשים ──
  const adminId = newId();
  const dannyId = newId();
  const ronitId = newId();
  const aviId = newId();
  const usersSeed: User[] = [
    {
      id: adminId, name: "מנהל המערכת", username: "admin", passwordHash: hashPassword("admin123"),
      role: "admin", permissions: { cases: true, inventory: true, service: true, viewCosts: true },
      active: true, createdAt: daysAgo(400),
    },
    {
      id: dannyId, name: "דני כהן", username: "danny", passwordHash: hashPassword("danny123"),
      role: "staff", permissions: { cases: true, inventory: true, service: true, viewCosts: true },
      active: true, createdAt: daysAgo(300),
    },
    {
      id: ronitId, name: "רונית לוי", username: "ronit", passwordHash: hashPassword("ronit123"),
      role: "staff", permissions: { cases: true, inventory: false, service: true, viewCosts: false },
      active: true, createdAt: daysAgo(200),
    },
    {
      id: aviId, name: "אבי מזרחי — אופני BYCYLE", username: "avi", passwordHash: hashPassword("avi123"),
      role: "agent", permissions: { cases: false, inventory: false, service: true, viewCosts: false },
      active: true, createdAt: daysAgo(120),
    },
  ];

  // ── הגדרות ──
  const settingsSeed: Settings = {
    importer: {
      name: "קורטז",
      phone: "03-6298909",
      email: "info@cortez.co.il",
      address: "תל אביב",
    },
    toolCategories: ["אופניים חשמליים", "קורקינטים חשמליים"],
    partCategories: ["סוללות", "מנועים", "צגים", "בקרים", "צמות ראשיות", "כפתורים וידיות גז"],
    defectCategories: ["מדבקה", "סימון", "תיוג", "אריזה", "תיעוד", "אחר"],
  };

  // ── דגמים (מהקטלוג האמיתי של קורטז) ──
  const mkModel = (
    commercialName: string, manufacturerCode: string, category: string,
    approval: ToolModel["approval"], createdDaysAgo: number
  ): ToolModel => ({
    id: newId(),
    commercialName, manufacturerCode,
    manufacturer: "Cortez",
    category, country: "סין",
    notes: "",
    archived: false,
    approval,
    createdAt: daysAgo(createdDaysAgo),
    updatedAt: daysAgo(createdDaysAgo),
  });

  const mMax2 = mkModel("CORTEZ MAX 2 2027", "CZ-MX2-27", "אופניים חשמליים", { status: "approved", approver: "מנהל המערכת", date: daysAgo(90), note: "אושר לייבוא" }, 100);
  const mSportRS = mkModel("CORTEZ SPORT RS", "CZ-SPRS", "אופניים חשמליים", { status: "approved", approver: "מנהל המערכת", date: daysAgo(70), note: "" }, 85);
  const mMax2RS = mkModel("CORTEZ MAX 2 RS", "CZ-MX2RS", "אופניים חשמליים", { status: "pending" }, 40);
  const mMax3 = mkModel("CORTEZ MAX 3 2027", "CZ-MX3-27", "אופניים חשמליים", { status: "approved", approver: "מנהל המערכת", date: daysAgo(60) }, 80);
  const m10x = mkModel("CORTEZ 10X", "CZ-10X", "קורקינטים חשמליים", { status: "approved", approver: "מנהל המערכת", date: daysAgo(50) }, 75);
  const mSharkG2 = mkModel("SHARK G2 PRO", "SHK-G2P", "קורקינטים חשמליים", { status: "returned", approver: "מנהל המערכת", date: daysAgo(10), note: "חסר אישור יצרן לתקן 1522" }, 20);

  // ── קבצי דוגמה: תמונות מדבקה לפני/אחרי + תעודות PDF ──
  const stickerBefore = await addFile(files, uploads, "מדבקה-לפני.svg", "svg", "image/svg+xml",
    stickerSvg("Sticker BEFORE", ["Made in PRC", "Model: E-Bike", "36V Li-ion"]), "דני כהן");
  const stickerAfter = await addFile(files, uploads, "מדבקה-אחרי.svg", "svg", "image/svg+xml",
    stickerSvg("Sticker AFTER", ["תוצרת סין", "דגם: CORTEZ MAX 2", "סוללת ליתיום 48V"], "#EAF6EC", "#0E7A3C"), "דני כהן");
  const cert1 = await addFile(files, uploads, "תעודה-1042.pdf", "pdf", "application/pdf",
    samplePdf([
      "Cortez - SII Inspection Certificate (sample)",
      "Certificate No: 1042",
      "Model: CORTEZ MAX 2 2027",
      "Standard: IL-1522",
      "Conclusion: Defects found - see attached pages",
    ]).toString("latin1"), "דני כהן");
  const cert2 = await addFile(files, uploads, "תעודה-1043.pdf", "pdf", "application/pdf",
    samplePdf([
      "Cortez - SII Inspection Certificate (sample)",
      "Certificate No: 1043",
      "Model: CORTEZ 10X",
      "Standard: IL-1522",
      "Conclusion: Approved",
    ]).toString("latin1"), "דני כהן");

  // ── תיק 1: מדבקה שתוקנה וממתינה לאימות ──
  const case1Id = newId();
  const defect1Id = newId();
  const defect2Id = newId();

  const defect1: Defect = {
    id: defect1Id,
    caseId: case1Id,
    category: "מדבקה",
    title: "כיתוב מדבקת יצרן שגוי",
    asReceived: "על המדבקה נכתב Made in PRC במקום תוצרת סין, ואין ציון מתח הסוללה בעברית",
    certificateSection: "סעיף 3.2",
    certificatePage: "עמוד 4",
    requiredChange: "החלפת המדבקה בנוסח המאושר: תוצרת סין, דגם, מתח סוללה",
    owner: "דני כהן",
    dueDate: daysAhead(3),
    status: "awaitingVerification",
    needsRecheck: true,
    sticker: {
      existingText: "Made in PRC · Model: E-Bike · 36V Li-ion",
      requiredText: "תוצרת סין · דגם: CORTEZ MAX 2 · סוללת ליתיום 48V",
      updatedText: "תוצרת סין · דגם: CORTEZ MAX 2 · סוללת ליתיום 48V",
      location: "על הצינור התחתון של השלדה",
    },
    fix: {
      date: daysAgo(4),
      performer: "דני כהן",
      description: "הודפסה מדבקה חדשה בנוסח המאושר והוחלפה על כל יחידות המשלוח",
      beforeFileIds: [stickerBefore.id],
      afterFileIds: [stickerAfter.id],
    },
    verification: { method: "בדיקה חוזרת אצל היבואן", result: "" },
    history: [
      { at: daysAgo(12), user: "דני כהן", action: "נפתח", to: "פתוח" },
      { at: daysAgo(6), user: "דני כהן", action: "עדכון סטטוס", from: "פתוח", to: "בטיפול" },
      { at: daysAgo(4), user: "דני כהן", action: "תיקון תועד ודווח", from: "בטיפול", to: "תוקן" },
      { at: daysAgo(4), user: "דני כהן", action: "הועבר לאימות — נדרשת בדיקה חוזרת", from: "תוקן", to: "ממתין לאימות" },
    ],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(4),
  };

  const defect2: Defect = {
    id: defect2Id,
    caseId: case1Id,
    category: "תיוג",
    title: "חוסר תווית אזהרה לילדים",
    asReceived: "בדף הליקויים נדרש להוסיף תווית אזהרה מפני נשיאת ילדים",
    certificateSection: "סעיף 7.1",
    certificatePage: "עמוד 6",
    requiredChange: "הוספת תווית אזהרה על הכידון",
    owner: "רונית לוי",
    dueDate: daysAhead(10),
    status: "open",
    needsRecheck: false,
    sticker: {},
    fix: { beforeFileIds: [], afterFileIds: [] },
    verification: {},
    history: [{ at: daysAgo(12), user: "דני כהן", action: "נפתח", to: "פתוח" }],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12),
  };

  const case1: InspectionCase = {
    id: case1Id,
    caseNumber: `CR-${now.getFullYear()}-001`,
    modelId: mMax2.id,
    sampleId: "SN-2231",
    owner: "דני כהן",
    openedAt: daysAgo(14),
    dueDate: daysAhead(7),
    status: "inProgress",
    notes: "משלוח ראשון של ליין 2027",
    nextAction: "קבלת אישור בדיקה חוזרת מהמכון",
    order: {
      customer: "קורטז בע״מ — יבואן רשמי",
      orderDate: daysAgo(60),
      instituteRequestNo: "7653204478",
      sampleTakenAt: daysAgo(20),
      sampleQuantity: "1 יחידה",
      waybill: "52971866-607",
      port: "חיפה",
      entryDate: daysAgo(18),
      supplier: "Kunshan Erica Import & Export",
      supplierAccount: "2026PI040002",
      invoiceDate: daysAgo(61),
    },
    inspection: {
      certificateNo: "1042",
      labSampleNo: "10103171",
      lab: "המעבדה להנדסה ואלקטרוניקה — מכון התקנים",
      standardNo: "15194",
      procedureNo: "ח-02-2019",
      essence: "בדיקת דגם לצורך אישור יבוא — אופניים חשמליים: בטיחות, בלימה, תאורה, סימון ותיוג",
      testFrom: daysAgo(30),
      testTo: daysAgo(13),
      issueDate: daysAgo(12),
      inspectorName: "אושרת לוי — פקיד ראשי",
      conclusion: "התקבלו ליקויים בסימון ובתיוג — נדרש תיקון אצל היבואן ובדיקה חוזרת. פרוטוקול הבדיקה מצורף בנספחים",
      officialResult: "",
    },
    checklist: [
      { id: newId(), label: "תעודה מלאה נקלטה", done: true },
      { id: newId(), label: "צילום מדבקה מתוקנת", done: true },
      { id: newId(), label: "תוצאת בדיקה חוזרת", done: false },
    ],
    history: [
      { at: daysAgo(14), user: "דני כהן", action: "התיק נפתח", to: "פתוח" },
      { at: daysAgo(13), user: "דני כהן", action: "פרטי תעודה נקלטו", to: "בטיפול" },
      { at: daysAgo(4), user: "דני כהן", action: "מדבקה תוקנה — ממתין לבדיקה חוזרת", from: "בטיפול", to: "בטיפול" },
    ],
    createdAt: daysAgo(14),
    updatedAt: daysAgo(4),
  };

  // ── תיק 2: ממתין למכון ──
  const case2: InspectionCase = {
    id: newId(),
    caseNumber: `CR-${now.getFullYear()}-002`,
    modelId: m10x.id,
    sampleId: "SN-8874",
    owner: "רונית לוי",
    openedAt: daysAgo(30),
    dueDate: daysAhead(14),
    status: "awaitingInstitute",
    notes: "",
    nextAction: "מעקב אחר תשובת המעבדה",
    order: {
      customer: "קורטז — מחלקת יבוא",
      orderDate: daysAgo(75),
      instituteRequestNo: "4498",
      sampleTakenAt: daysAgo(35),
      sampleQuantity: "1 יחידה",
      waybill: "BL-77120",
      port: "אשדוד",
      entryDate: daysAgo(33),
      supplier: "Jinhua Scooters Co",
      supplierAccount: "504-77120",
    },
    inspection: {
      certificateNo: "1043",
      labSampleNo: "10103172",
      lab: "מעבדת מכניקה — מכון התקנים",
      standardNo: "15194",
      procedureNo: "ח-02-2019",
      essence: "בדיקת דגם לצורך אישור יבוא — קורקינט חשמלי",
      testFrom: daysAgo(32),
      testTo: daysAgo(29),
      issueDate: daysAgo(28),
      inspectorName: "אושרת לוי — פקיד ראשי",
      conclusion: "אושר ללא ליקויים",
      officialResult: "עבר בהתאמה מלאה",
    },
    checklist: [
      { id: newId(), label: "תעודה מלאה נקלטה", done: true },
    ],
    history: [
      { at: daysAgo(30), user: "רונית לוי", action: "התיק נפתח", to: "פתוח" },
      { at: daysAgo(28), user: "רונית לוי", action: "הועבר להמתנה למכון", from: "פתוח", to: "ממתין למכון" },
    ],
    createdAt: daysAgo(30),
    updatedAt: daysAgo(28),
  };

  // ── תיק 3: טיוטה ──
  const case3: InspectionCase = {
    id: newId(),
    caseNumber: `CR-${now.getFullYear()}-003`,
    modelId: mSharkG2.id,
    sampleId: "",
    owner: "דני כהן",
    openedAt: daysAgo(5),
    status: "draft",
    notes: "טיוטה — ממתינים לקבלת התעודה במייל",
    nextAction: "להשלים פרטי משלוח",
    order: { customer: "קורטז — מחלקת יבוא", orderDate: daysAgo(12) },
    inspection: {},
    checklist: [
      { id: newId(), label: "תעודה מלאה", done: false },
      { id: newId(), label: "צילום מדבקה מתוקנת", done: false },
    ],
    history: [{ at: daysAgo(5), user: "דני כהן", action: "טיוטה נוצרה", to: "טיוטה" }],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  };

  // ── מסמכים ──
  const documents: CaseDocument[] = [
    {
      id: newId(), caseId: case1Id, defectIds: [defect1Id, defect2Id], type: "certificate",
      fileId: cert1.id, originalName: "תעודה-1042.pdf", title: "תעודת בדיקה 1042",
      uploadedBy: "דני כהן", uploadedAt: daysAgo(12), note: "התעודה כפי שהתקבלה במייל מהמכון",
    },
    {
      id: newId(), caseId: case1Id, defectIds: [defect1Id], type: "fixProof",
      fileId: stickerBefore.id, originalName: "מדבקה-לפני.svg", title: "מדבקה לפני תיקון",
      uploadedBy: "דני כהן", uploadedAt: daysAgo(6),
    },
    {
      id: newId(), caseId: case1Id, defectIds: [defect1Id], type: "fixProof",
      fileId: stickerAfter.id, originalName: "מדבקה-אחרי.svg", title: "מדבקה אחרי תיקון",
      uploadedBy: "דני כהן", uploadedAt: daysAgo(4),
    },
    {
      id: newId(), caseId: case2.id, defectIds: [], type: "certificate",
      fileId: cert2.id, originalName: "תעודה-1043.pdf", title: "תעודת בדיקה 1043",
      uploadedBy: "רונית לוי", uploadedAt: daysAgo(28),
    },
  ];

  // ── חלפים ──
  const mkPart = (
    sku: string, name: string, category: string, qty: number,
    shopPrice: number, importCost: number, partModel: string, manufacturer: string,
    compatible: string[]
  ): Part => ({
    id: newId(), sku, name, partModel, manufacturer, imageFileIds: [], category,
    qty, shopPrice, importCost, compatibleModelIds: compatible, notes: "",
    createdAt: daysAgo(90), updatedAt: daysAgo(2),
  });

  const pBattery = mkPart("BAT-48V-13AH", "סוללה 48V/13Ah לסדרת MAX", "סוללות", 14, 890, 520, "RB-4813", "Cortez", [mMax2.id, mMax2RS.id, mMax3.id]);
  const pMotor = mkPart("MOT-250W", "מנוע 250W גלגל אחורי", "מנועים", 6, 650, 380, "M-250R", "Cortez", [mMax2.id, mSportRS.id, mMax3.id]);
  const pDisplay = mkPart("DISP-LCD3", "צג דיגיטלי LCD", "צגים", 9, 320, 180, "LCD-3", "Shengyi", [mMax2.id, mMax2RS.id, mMax3.id, mSportRS.id]);
  const pController = mkPart("CTRL-48V", "בקר 48V", "בקרים", 11, 410, 230, "CT-48", "Cortez", [mMax2.id, mMax2RS.id, mSportRS.id]);
  const pHarness = mkPart("HRN-MAIN-48", "צמה ראשית 48V", "צמות ראשיות", 4, 150, 70, "WH-48", "Cortez", [mMax2.id, mMax3.id]);
  const pThrottle = mkPart("THR-HALF", "ידית גז חצי", "כפתורים וידיות גז", 18, 120, 55, "TH-05", "Cortez", [m10x.id, mSharkG2.id]);
  const pButton = mkPart("BTN-PWR", "כפתור התנעה", "כפתורים וידיות גז", 25, 60, 25, "BT-01", "Cortez", [m10x.id, mSharkG2.id, mMax2.id]);
  const parts = [pBattery, pMotor, pDisplay, pController, pHarness, pThrottle, pButton];

  const movements: PartMovement[] = [
    { id: newId(), partId: pBattery.id, type: "in", qty: 20, reason: "קליטת משלוח ראשון", user: "דני כהן", at: daysAgo(60) },
    { id: newId(), partId: pBattery.id, type: "out", qty: 6, reason: "חלוקה למשווקים", user: "דני כהן", at: daysAgo(20) },
    { id: newId(), partId: pMotor.id, type: "in", qty: 8, reason: "קליטת משלוח", user: "דני כהן", at: daysAgo(45) },
    { id: newId(), partId: pMotor.id, type: "out", qty: 2, reason: "החלפה באחריות", user: "דני כהן", at: daysAgo(10) },
    { id: newId(), partId: pThrottle.id, type: "in", qty: 20, reason: "קליטה", user: "דני כהן", at: daysAgo(30) },
    { id: newId(), partId: pThrottle.id, type: "adjust", qty: 18, reason: "ספירת מלאי — תיקון פער", user: "דני כהן", at: daysAgo(2) },
  ];

  // ── קריאות שירות ──
  const serviceCalls: ServiceCall[] = [
    {
      id: newId(), callNumber: `SC-${now.getFullYear()}-001`,
      agentId: aviId, agentName: "אבי מזרחי — אופני BYCULE",
      modelId: mMax2.id, frameNumber: "FR-99231",
      contactName: "לקוח בחנות", contactPhone: "050-0000000",
      description: "הצג לא מדליק אחרי שבועיים של שימוש. הכלי נטען רגיל אבל התצוגה כבויה.",
      attachmentFileIds: [], linkedPartIds: [pDisplay.id],
      status: "inProgress", assignee: "דני כהן",
      treatmentLog: [
        { id: newId(), at: daysAgo(3), user: "דני כהן", note: "נבדק בטלפון — ככל הנראה צם או צג. הוזמן צג חלופי." },
      ],
      history: [
        { at: daysAgo(4), user: "אבי מזרחי — אופני BYCULE", action: "הקריאה נפתחה", to: "חדשה" },
        { at: daysAgo(3), user: "דני כהן", action: "הקצאת אחראי", to: "דני כהן" },
        { at: daysAgo(3), user: "דני כהן", action: "עדכון סטטוס", from: "חדשה", to: "בטיפול" },
      ],
      createdAt: daysAgo(4), updatedAt: daysAgo(3),
    },
    {
      id: newId(), callNumber: `SC-${now.getFullYear()}-002`,
      agentId: aviId, agentName: "אבי מזרחי — אופני BYCULE",
      modelId: m10x.id, frameNumber: "FR-11220",
      contactName: "שוהם", contactPhone: "052-0000000",
      description: "ידית גז נתקעת במצב פתוח. הכלי ממשיך לנסוע גם בלי לחיצה.",
      attachmentFileIds: [], linkedPartIds: [pThrottle.id],
      status: "new",
      treatmentLog: [],
      history: [],
      createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
  ];

  // ── התראות ──
  const notifications: Notification[] = [
    {
      id: newId(), audience: ["admin", "staff"],
      message: "קריאת שירות חדשה SC-2026-002 מאבי מזרחי — ידית גז נתקעת",
      link: `/service/${serviceCalls[1].id}`,
      readBy: [], createdAt: daysAgo(1),
    },
  ];

  // ── שמירת הכול ──
  await writeCollection("users", () => usersSeed);
  await writeCollection<ToolModel>("models", () => [mMax2, mSportRS, mMax2RS, mMax3, m10x, mSharkG2]);
  await writeCollection<InspectionCase>("cases", () => [case1, case2, case3]);
  await writeCollection<Defect>("defects", () => [defect1, defect2]);
  await writeCollection<CaseDocument>("documents", () => documents);
  await writeCollection<StoredFile>("files", () => files);
  await writeCollection<Part>("parts", () => parts);
  await writeCollection<PartMovement>("movements", () => movements);
  await writeCollection<ServiceCall>("serviceCalls", () => serviceCalls);
  await writeCollection<Notification>("notifications", () => notifications);
  await writeCollection<Settings>("settings", () => [settingsSeed]);
  await seedInitialRepairs([mMax2, mSportRS, mMax2RS, mMax3, m10x, mSharkG2], parts);

  for (const u of uploads) {
    await storage.saveUpload(u.id, u.buf);
  }

  return true;
}

async function seedInitialRepairs(models: ToolModel[], parts: Part[]) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const daysAgo = (n: number) => iso(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));
  const year = now.getFullYear();

  const bike1 = models.find((m) => m.category.includes("אופניים")) ?? models[0];
  const scooter1 = models.find((m) => m.category.includes("קורקינט")) ?? models[1] ?? models[0];
  const bike2 = models.filter((m) => m.category.includes("אופניים"))[1] ?? bike1;
  const displayPart = parts.find((p) => p.sku.includes("DISP"));
  const throttlePart = parts.find((p) => p.sku.includes("THR"));

  const repairsSeed: Repair[] = [
    {
      id: newId(),
      repairNumber: `RP-${year}-001`,
      deviceType: "bicycle",
      modelId: bike1?.id ?? "",
      modelName: bike1?.commercialName ?? "CORTEZ MAX 2 2027",
      serialNumber: "SN-MX2-40912",
      faultDescription: "צג לא נדלק לאחר רכיבה בגשם, שגיאת תקשורת E-3 עם הבקר",
      fixDescription: "נבדקה צמה ראשית, הוזמן צג LCD-3 להחלפה",
      delayReason: "ממתין לאישור לקוח על החלפת צג וצמה",
      status: "inProgress",
      technician: "דני כהן",
      customerName: "אופני העיר — סניף מרכז",
      customerPhone: "050-8112233",
      usedPartIds: displayPart ? [displayPart.id] : [],
      notes: "נבדק מתח סוללה — תקין (54.2V)",
      history: [
        { at: daysAgo(5), user: "דני כהן", action: "נפתח כרטיס תיקון", to: "ממתין לתיקון" },
        { at: daysAgo(3), user: "דני כהן", action: "שינוי סטטוס", from: "ממתין לתיקון", to: "בטיפול" },
        { at: daysAgo(2), user: "דני כהן", action: "עדכון סיבת עיכוב", to: "ממתין לאישור לקוח על החלפת צג וצמה" },
      ],
      createdBy: "דני כהן",
      createdAt: daysAgo(5),
      updatedAt: daysAgo(2),
    },
    {
      id: newId(),
      repairNumber: `RP-${year}-002`,
      deviceType: "scooter",
      modelId: scooter1?.id ?? "",
      modelName: scooter1?.commercialName ?? "CORTEZ 10X",
      serialNumber: "SN-10X-88719",
      faultDescription: "ידית גז נתקעת ולעיתים הכלי מפסיק להגיב באמצע נסיעה",
      fixDescription: "",
      delayReason: "",
      status: "waiting",
      technician: "דני כהן",
      customerName: "אבי מזרחי — אופני BYCYLE",
      customerPhone: "052-4455667",
      usedPartIds: throttlePart ? [throttlePart.id] : [],
      notes: "הגיע היום עם שליח למעבדה",
      history: [
        { at: daysAgo(1), user: "רונית לוי", action: "נפתח כרטיס תיקון", to: "ממתין לתיקון" },
      ],
      createdBy: "רונית לוי",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: newId(),
      repairNumber: `RP-${year}-003`,
      deviceType: "bicycle",
      modelId: bike2?.id ?? "",
      modelName: bike2?.commercialName ?? "CORTEZ SPORT RS",
      serialNumber: "SN-SPRS-10394",
      faultDescription: "חופש בכידון ורעש בבלימה קדמית",
      fixDescription: "חיזוק מערכת היגוי, החלפת רפידות בלם קדמי וכיול דיסק",
      delayReason: "",
      status: "completed",
      technician: "דני כהן",
      customerName: "רוכב פרטי — יוסי לוי",
      customerPhone: "054-9988776",
      usedPartIds: [],
      notes: "נמסר חזרה ללקוח לאחר נסיעת מבחן",
      completedAt: daysAgo(2),
      history: [
        { at: daysAgo(7), user: "דני כהן", action: "נפתח כרטיס תיקון", to: "ממתין לתיקון" },
        { at: daysAgo(6), user: "דני כהן", action: "שינוי סטטוס", from: "ממתין לתיקון", to: "בטיפול" },
        { at: daysAgo(2), user: "דני כהן", action: "תועד מה תוקן", to: "חיזוק מערכת היגוי, החלפת רפידות בלם קדמי וכיול דיסק" },
        { at: daysAgo(2), user: "דני כהן", action: "שינוי סטטוס", from: "בטיפול", to: "תיקון הסתיים" },
      ],
      createdBy: "דני כהן",
      createdAt: daysAgo(7),
      updatedAt: daysAgo(2),
    },
  ];

  await writeCollectionIfAbsent<Repair>("repairs", repairsSeed);
}
