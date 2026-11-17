#!/usr/bin/env node
/**
 * מיגרציה חד־פעמית: כותב מחדש את כל בלובי האוספים עם cacheControl: no-store
 * כדי שה־CDN הפנימי של Vercel לא יגיש גרסאות ישנות לפונקציות.
 * שימוש: node scripts/migrate-blob-cache.cjs
 */
const fs = require("fs");
const path = require("path");

// קריאת הטוקן מ-.env.local (נוצר אוטומטית ע"י vercel blob create-store)
const envLocal = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const token = envLocal.match(/BLOB_READ_WRITE_TOKEN="?([^"\r\n]+)"?/)?.[1];
if (!token) {
  console.error("לא נמצא BLOB_READ_WRITE_TOKEN ב-.env.local");
  process.exit(1);
}
process.env.BLOB_READ_WRITE_TOKEN = token;

const { list, head, put } = require("@vercel/blob");

(async () => {
  const { blobs } = await list({ prefix: "cortez-ops/collections/" });
  console.log(`נמצאו ${blobs.length} אוספים למיגרציה`);
  for (const b of blobs) {
    const info = await head(b.pathname);
    const res = await fetch(info.url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const content = await res.text();
    await put(b.pathname, content, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 0,
      contentType: "application/json",
    });
    console.log("✓", b.pathname, `(${content.length} bytes)`);
  }
  console.log("המיגרציה הושלמה");
})().catch((e) => {
  console.error("מיגרציה נכשלה:", e.message);
  process.exit(1);
});
