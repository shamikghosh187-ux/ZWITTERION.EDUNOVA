# Zwitterion Classes — Admin Portal demo access

## Temporary preview credentials

The current Admin Portal uses a deliberately temporary, client-side demo flow:

- Demo email: `admin-demo@zwitterionclasses.co.in`
- Demo password: `ZwitterionDemo!2026`

Entering the demo email opens a password modal. A successful demo password opens a read-only preview screen.

## Important security boundary

**These are public demo credentials, not real authentication.** The email and password are embedded in the browser HTML and can be read by anyone. Do not use them for a real account, do not reuse the password elsewhere, and do not treat the demo screen as proof that a visitor is an administrator.

The demo flow must not authorize any protected server operation. Real uploads, publishing, protected downloads, and deletion remain disabled until server-verified authentication and authorization are implemented.

## Before production

1. Replace the client-side demo gate with Supabase Auth (email/password or magic link) for Sir's real account.
2. Restrict admin access with server-side identity checks and role authorization; never trust a client-side flag.
3. Keep PDFs in a private Supabase Storage bucket and issue access only after server-side authorization.
4. Apply database/storage RLS policies, file-size limits, and free-tier quota checks. Do not enable automatic paid upgrades.
5. Store server secrets only in deployment environment variables. Never place a Supabase service-role key in `index.html` or other browser code.

The old `/api/admin-email-check` endpoint is not used by the demo sign-in flow. It is only an allowlist convenience endpoint and does not issue a session, token, cookie, or role credential.
