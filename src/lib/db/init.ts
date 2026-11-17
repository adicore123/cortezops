import { seedIfNeeded } from "./seed";

let initPromise: Promise<boolean> | null = null;

/** מאתחל את האחסון פעם אחת לכל תהליך שרת (seed בהרצה ראשונה). */
export function ensureInit(): Promise<boolean> {
  if (!initPromise) {
    initPromise = seedIfNeeded().catch((err) => {
      initPromise = null; // אפשר לנסות שוב בבקשה הבאה
      throw err;
    });
  }
  return initPromise;
}
