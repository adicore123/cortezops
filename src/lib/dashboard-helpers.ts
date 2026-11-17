import { readCollection } from "./db/store";
import { ensureInit } from "./db/init";

/** re-export נוח לעמודי שרת */
export { readCollection };
export async function ensureInitSafe() {
  await ensureInit();
}
