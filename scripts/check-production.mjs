import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(/<title>Zwitterion Classes<\/title>/i.test(html), "Document title must be Zwitterion Classes.");
assert(/name="description" content="Zwitterion Classes/i.test(html), "SEO description must use Zwitterion Classes branding.");
assert(!/teacher@zwitterion\.demo|Teacher123!|Submit Demo Attempt/.test(html), "Production HTML must not expose demo credentials or demo assessment submission.");
assert(!/Accuracy','86%/.test(html), "Production HTML must not show a fabricated accuracy statistic.");
assert(html.includes("admin-portal") && html.includes("This screen is a convenience check, not authentication"), "Admin Portal must disclose email-only limitations.");
assert(html.includes("/api/admin-email-check"), "Admin Portal email-check endpoint is missing.");

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
  console.log(`Production smoke checks passed: ${scripts.length} inline scripts, branding, demo-data guardrails, and API syntax.`);
}
