import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(/<title>Zwitterion Classes<\/title>/i.test(html), "Document title must be Zwitterion Classes.");
assert(/name="description" content="Zwitterion Classes/i.test(html), "SEO description must use Zwitterion Classes branding.");
assert(!/teacher@zwitterion\.demo|Teacher123!|Submit Demo Attempt/.test(html), "Production HTML must not expose demo credentials or demo assessment submission.");
assert(!/Accuracy','86%/.test(html), "Production HTML must not show a fabricated accuracy statistic.");
assert(html.includes("admin-portal") && html.includes("Demo mode only") && html.includes("This is not a verified administrator session"), "Admin Portal must disclose that demo access is not authentication.");
assert(html.includes("admin-demo@zwitterionclasses.co.in") && html.includes("ZwitterionDemo!2026"), "Temporary demo admin credentials must be present for preview.");
assert(html.includes("zw-admin-password-modal") && html.includes("zw-admin-password-form"), "Admin Portal password modal is missing.");
assert(html.includes("zw-resource-form") && html.includes("zw-resource-file") && html.includes("Upload disabled until secure admin authentication is configured"), "Resource upload form must remain present but disabled until verified auth is configured.");
assert(html.includes("No resources uploaded yet") && html.includes("demo email/password does not create a verified admin session"), "Resource library must remain empty in demo mode.");
const resourceSchema = readFileSync(new URL("../supabase/resource-library.sql", import.meta.url), "utf8");
assert(resourceSchema.includes("public.admin_users") && resourceSchema.includes("public.resources"), "Supabase resource schema is missing admin and resource tables.");
assert(resourceSchema.includes("public = false") && resourceSchema.includes("class-resources"), "Supabase resource bucket must remain private.");
assert(resourceSchema.includes("file_size_bytes <= 10485760") && resourceSchema.includes("application/pdf"), "Resource schema must enforce PDF-only 10 MiB limits.");

const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
assert(scripts.length > 0, "No inline scripts were found.");
for (let i = 0; i < scripts.length; i += 1) {
  let source = scripts[i][2];
  // The browser loads this one script as a module; removing its import declaration
  // allows Node's parser to syntax-check the remaining inline body without network access.
  if (/\btype=["']module["']/.test(scripts[i][1])) {
    source = source.replace(/^\s*import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];?\s*/m, "\n");
  }
  try {
    new Script(source, { filename: `index.html:inline-script-${i + 1}` });
  } catch (error) {
    failures.push(`Inline script ${i + 1} has a syntax error: ${error.message}`);
  }
}

for (const path of ["api/access-code.js", "api/student/send-otp.js", "api/student/verify-otp.js", "api/admin-email-check.js"]) {
  try {
    const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
    new Script(source.replace(/^\s*import\s+.*?;\s*/gm, "\n").replace(/\bexport\s+default\s+/, ""), { filename: path });
    if (path === "api/admin-email-check.js") {
      if (/json\s*\(\s*\{[^}]*\btoken\b|setCookie|Set-Cookie/i.test(source)) failures.push("Admin email-check endpoint must not issue authentication credentials.");
      if (!source.includes("ADMIN_ALLOWED_EMAIL")) failures.push("Admin email-check endpoint must use server-side ADMIN_ALLOWED_EMAIL.");
    }
  } catch (error) {
    failures.push(`Could not parse ${path}: ${error.message}`);
  }
}

if (failures.length) {
  console.error("Production checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Production smoke checks passed: ${scripts.length} inline scripts, branding, demo-login warning, upload-disabled guardrails, resource schema checks, and API syntax.`);
}
