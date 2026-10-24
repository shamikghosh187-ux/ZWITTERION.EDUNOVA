# Zwitterion Classes — secure resource library setup

This repository contains the resource-library form and a Supabase SQL setup script, but the form is intentionally disabled. The current Admin Portal is a browser-only preview and is **not authentication**.

## Security model

- Supabase Auth verifies the administrator; no password is embedded in browser JavaScript.
- The `class-resources` Storage bucket must remain private.
- Uploads are restricted to PDF MIME type and 10 MiB at the bucket level, and resource metadata also records the size limit.
- The signed-in admin must have a row in `public.admin_users`; being signed in alone does not grant admin permissions.
- Files must be stored under the admin's Auth UUID, for example `<auth-user-uuid>/<generated-file-name>.pdf`.
- The browser may use only the Supabase project URL and publishable/anon key. Never place a service-role/secret key in `index.html`, a public environment variable, or the repository.
- Student download access is deliberately not enabled by this initial schema. The current student UI uses a demo/local account flow, which cannot securely authorize private files. Add verified student authentication and a published-resource access policy or a short-lived signed-URL endpoint before exposing downloads.

## Setup

1. Create or identify a **dedicated Supabase project for Zwitterion Classes**. Do not reuse another application's project unless you explicitly confirm it is the intended project.
2. In Supabase Auth, create the administrator user using the real admin email and a strong, unique password. Do not put that password into GitHub.
3. Open the project's SQL Editor and run `supabase/resource-library.sql`. This is an initial setup script; if tables or policies already exist, inspect them before rerunning because policy names may already exist.
4. Copy the Auth user's UUID from the Supabase dashboard and add only that UUID to `public.admin_users` using the SQL snippet at the bottom of the SQL file.
5. In Supabase Storage, verify `class-resources` is private and the bucket's allowed MIME type is `application/pdf` with a 10 MiB limit. The SQL script sets these restrictions.
6. Configure the site with the project's URL and publishable/anon key. These values are designed for public clients; access is secured by Auth and RLS, not by hiding the publishable key.
7. Implement the browser integration using Supabase Auth, then upload files under the authenticated user's UUID and insert matching metadata. Keep the submit action disabled until the real project configuration is present and the user session is verified.
8. Before launch, test that an anonymous visitor cannot upload, list, or download a private PDF; a signed-in non-admin cannot upload; the admin can upload; and a file larger than 10 MiB or a non-PDF is rejected.

## Current status

The repository has a private-bucket schema and a disabled UI form, but no connected production upload flow yet. A Supabase project named `WYGO` is visible in the connected workspace; its name does not establish that it belongs to Zwitterion, so this setup does not change it.
