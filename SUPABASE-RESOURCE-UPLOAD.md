# Zwitterion Classes — Resource upload setup

This change adds the Admin resource upload interface and a Supabase schema for a **private, free-tier-only** resource library. The browser UI deliberately keeps uploads disabled until verified admin authentication is connected.

## Current status

- The email/password demo remains preview-only.
- The resource form collects title, type, class, subject, description, and a PDF.
- The form is disabled at submission time by design; it does not upload files or create fake resource records.
- PDFs are intended for the private Supabase Storage bucket `class-resources`.
- The initial per-file cap is 10 MiB. This is a client-facing guardrail, not a guarantee of total free storage. Check the current Supabase free quota before enabling uploads.
- No automatic paid upgrade is configured or permitted. If the free quota is reached, pause uploads and remove/archive files or wait for quota reset; do not upgrade automatically.

## Supabase setup (manual, after Sir provides his real email)

1. Create/use a Supabase project on the Free plan only.
2. In Supabase Authentication, create Sir's real user account. Do not use the public demo credentials.
3. Run `supabase/resource-library.sql` in the SQL Editor.
4. Insert Sir's verified Auth user UUID into `public.admin_users` as shown in the SQL file. Never add a demo user.
5. Keep the `class-resources` bucket private. Do not expose a service-role key to the browser.
6. Before enabling upload, implement the real Supabase Auth sign-in in Admin Portal and use the authenticated user's session. The existing demo flow does not provide a Supabase access token.
7. Before students can download a published PDF, add an authorized server-side endpoint that checks the resource's published status and issues a short-lived signed URL. Do not make the bucket public.
8. Add server-side quota/usage checks and rate limits. Client-side file size/type checks alone are not security controls.

## Free tier safeguards

- Keep the Supabase project on the Free plan.
- No paid-plan automation, no silent upgrades, no fabricated capacity estimates.
- Before each upload, the eventual backend must check the current storage usage and the configured safety threshold. If usage cannot be checked or is at/over the threshold, fail closed and explain why.
- Do not enable upload/publish/delete APIs until auth, RLS, private bucket, and quota checks have been tested.

## Validation

Run `npm run check:production`. The schema itself must be run and tested in the Supabase project before any deployment can be considered ready.
