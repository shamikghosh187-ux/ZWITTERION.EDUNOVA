# Zwitterion Classes — Admin email allowlist (UI check only)

## Configuration

In the Vercel project, add the environment variable:

- `ADMIN_ALLOWED_EMAIL`: Sir's authorized email address.

Redeploy the relevant preview after configuring the variable so the serverless function can read it.

## Important security boundary

The Admin Portal asks for an email and checks it against the configured allowlist without a password or OTP, as requested. **This is not authentication.** Anyone can submit an email address to the public check endpoint, and a matching result does not prove that the visitor owns that inbox.

The endpoint `/api/admin-email-check` issues no session, token, cookie, or role credential. It exists only to control the portal's informational UI. Do not use its `allowed` response to authorize any server operation.

Admin content reads/writes, uploads, publishing, and deletion must remain disabled until a separate, verified server-side authentication and authorization mechanism is implemented. Every protected API must independently validate that mechanism. Do not rely on client-side role flags, localStorage, or this allowlist response.

The endpoint reveals whether a submitted address matches the configured allowlist. Add rate limiting/abuse monitoring before treating it as a hardened production feature.
