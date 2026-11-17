// ─── טיפוסי נתונים של מערכת קורטז ───────────────────────────────────────────

export type Role = "admin" | "staff" | "agent";

export interface Permissions {
  cases: boolean;
  inventory: boolean;
  service: boolean;
  viewCosts: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: Role;
  permissions: Permissions;
  active: boolean;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export type ApprovalStatus = "pending" | "approved" | "returned";

export interface ModelApproval {
  status: ApprovalStatus;
  approver?: string;
  date?: string;
  note?: string;
}

export interface ToolModel {
  id: string;
  commercialName: string;
  manufacturerCode: string;
  manufacturer: string;
  category: string; // קטגוריית כלי (אופניים חשמליים / קורקינטים חשמליים...)
  country: string;
  imageFileId?: string;
  notes?: string;
  archived: boolean;
  approval: ModelApproval;
  createdAt: string;
  updatedAt: string;
}

export type CaseStatus = "draft" | "open" | "inProgress" | "awaitingInstitute" | "completed";

export interface CaseChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface InspectionCase {
  id: string;
  caseNumber: string; // CR-2026-001
  modelId: string;
  sampleId?: string; // מזהה מדגם / מספר שלדה
  owner?: string; // אחראי
  openedAt: string;
  dueDate?: string;
  status: CaseStatus;
  notes?: string;
  nextAction?: string;
  // הזמנה ומשלוח
  order: {
    customer?: string; // שם הפונה / מזמין
    orderDate?: string; // תאריך פנייה / הזמנה
    instituteRequestNo?: string; // מספר בקשה במכון
    sampleTakenAt?: string; // תאריך נטילת המדגם
    sampleQuantity?: string; // כמות במשלוח
    waybill?: string; // מספר משלוח / שטר מטען
    port?: string; // נמל
    entryDate?: string; // תאריך כניסה
    supplier?: string; // שם ספק
    supplierAccount?: string; // מספר חשבון / פקטורה
    invoiceDate?: string; // תאריך חשבון
  };
  // בדיקה (לפי תעודת מכון התקנים)
  inspection: {
    certificateNo?: string; // מספר תעודת בדיקה
    labSampleNo?: string; // מספר בקשה פנימי במעבדה
    lab?: string; // מעבדה
    standardNo?: string; // מספר תקן (למשל 15194)
    procedureNo?: string; // מספר נוהל (למשל ח-02-2019)
    essence?: string; // מהות הבדיקה
    testDate?: string; // (היסטורי) תאריך בדיקה בודד
    testFrom?: string; // תאריכי בדיקה — מ
    testTo?: string; // תאריכי בדיקה — עד
    issueDate?: string; // תאריך הפקה
    inspectorName?: string; // שם הבודק בתעודה
    conclusion?: string; // מסקנת הבדיקה כפי שנרשמה בתעודה
    officialResult?: string; // תוצאת הבדיקה הרשמית (מעודכן מאסמכתה)
  };
  checklist: CaseChecklistItem[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  at: string;
  user: string;
  action: string; // תיאור חופשי בעברית
  from?: string;
  to?: string;
}

export type DefectStatus = "open" | "inProgress" | "fixed" | "awaitingVerification" | "verified";

export interface DefectFix {
  date?: string;
  performer?: string;
  description?: string;
  beforeFileIds: string[];
  afterFileIds: string[];
}

export interface DefectVerification {
  method?: string; // למשל: בדיקה חוזרת
  result?: string;
  documentId?: string; // דוח חוזר מקושר
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface Defect {
  id: string;
  caseId: string;
  category: string; // מדבקה / סימון / תיוג / אריזה / תיעוד / אחר
  title: string;
  asReceived?: string; // נוסח הליקוי כפי שהתקבל
  certificateSection?: string; // סעיף בתעודה
  certificatePage?: string; // עמוד בתעודה
  requiredChange?: string; // מה נדרש לשנות
  owner?: string;
  dueDate?: string;
  status: DefectStatus;
  needsRecheck?: boolean; // נדרשת בדיקה חוזרת
  // מצב מדבקה
  sticker: {
    existingText?: string; // הכיתוב הקיים
    requiredText?: string; // הכיתוב שנדרש להחליף
    updatedText?: string; // הנוסח המעודכן
    location?: string; // מיקום המדבקה
  };
  fix: DefectFix;
  verification: DefectVerification;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type DocumentType = "certificate" | "reinspection" | "shipping" | "correspondence" | "fixProof";

export interface CaseDocument {
  id: string;
  caseId: string;
  defectIds: string[];
  type: DocumentType;
  fileId: string;
  originalName: string;
  title?: string;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
  supersededBy?: string; // דוח חדש שהחליף דוח זה
}

export interface StoredFile {
  id: string;
  originalName: string;
  ext: string;
  mime: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Part {
  id: string;
  sku: string; // מק״ט ייחודי
  name: string;
  partModel?: string; // דגם החלק
  manufacturer?: string;
  imageFileIds: string[];
  category: string;
  qty: number;
  shopPrice?: number; // מחיר לחנות
  importCost?: number; // עלות ליבואן
  compatibleModelIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = "in" | "out" | "adjust";

export interface PartMovement {
  id: string;
  partId: string;
  type: MovementType;
  qty: number;
  reason?: string;
  user: string;
  at: string;
}

export type ServiceCallStatus =
  | "new"
  | "inProgress"
  | "awaitingInfo"
  | "awaitingPart"
  | "resolved"
  | "closed";

export interface TreatmentEntry {
  id: string;
  at: string;
  user: string;
  note: string;
}

export interface ServiceCall {
  id: string;
  callNumber: string; // SC-2026-001
  agentId: string; // הסוכן שפתח — אוטומטי
  agentName: string;
  modelId?: string;
  frameNumber?: string;
  contactName?: string;
  contactPhone?: string;
  description: string;
  attachmentFileIds: string[];
  linkedPartIds: string[];
  status: ServiceCallStatus;
  assignee?: string;
  treatmentLog: TreatmentEntry[];
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  audience: Role[]; // למי להציג
  message: string;
  link?: string;
  readBy: string[];
  createdAt: string;
}

export interface Settings {
  importer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    logoFileId?: string; // עוקף את ברירת המחדל public/brand/cortez.png
  };
  toolCategories: string[];
  partCategories: string[];
  defectCategories: string[];
  lowStockThreshold?: number; // מתחת לכמות זו יוצג חיווי מלאי נמוך (ברירת מחדל 3)
}

// ─── מיפויי תצוגה בעברית ────────────────────────────────────────────────────

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  draft: "טיוטה",
  open: "פתוח",
  inProgress: "בטיפול",
  awaitingInstitute: "ממתין למכון",
  completed: "הושלם",
};

export const DEFECT_STATUS_LABELS: Record<DefectStatus, string> = {
  open: "פתוח",
  inProgress: "בטיפול",
  fixed: "תוקן",
  awaitingVerification: "ממתין לאימות",
  verified: "אומת",
};

export const CALL_STATUS_LABELS: Record<ServiceCallStatus, string> = {
  new: "חדשה",
  inProgress: "בטיפול",
  awaitingInfo: "ממתינה למידע",
  awaitingPart: "ממתינה לחלק",
  resolved: "נפתרה",
  closed: "נסגרה",
};

export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  certificate: "תעודת בדיקה",
  reinspection: "דוח חוזר",
  shipping: "מסמך משלוח",
  correspondence: "תכתובת",
  fixProof: "ראיית תיקון",
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  pending: "ממתין לאישור",
  approved: "מאושר פנימית",
  returned: "הוחזר להשלמות",
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  in: "קליטת מלאי",
  out: "יציאת מלאי",
  adjust: "התאמת ספירה",
};
