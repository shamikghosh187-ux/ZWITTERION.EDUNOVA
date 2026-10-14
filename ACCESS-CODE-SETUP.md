# ZWITTERION permanent access-code setup

## Behavior
- Students enter the shared code once per browser identity.
- A successful unlock is recorded in Neon in `student_access_grants`.
- Returning browsers remain unlocked after the shared code rotates.
- The current code expires for new unlocks at **2027-03-10 00:00 IST**.
- After expiry, set a new `STUDENT_ACCESS_CODE` in Vercel and update `ROTATION_AT` in `api/access-code.js` to the next rotation date before redeploying.

## Vercel environment variables
Add these to the Vercel project for Production and Preview as appropriate:
- `STUDENT_ACCESS_CODE`: the current code supplied by the teacher. Keep it secret; never put it in frontend JavaScript.
- `ACCESS_SESSION_SECRET`: a long random secret (at least 32 random bytes).
- `DATABASE_URL`: the existing Neon connection string.

Do not commit real secrets into GitHub.

## Important identity and content-security limits
This version associates a permanent grant with a random browser ID stored in localStorage. With no student login or verified identity, it cannot prove that the same human is returning. Clearing site data or switching devices can create a new ID and require the current code again.

The API records grants and verifies the shared code, but the existing dashboard still contains client-side code and may reference public PDF URLs. A frontend lock alone does **not** protect public files. Before treating course materials as private, move PDFs to private storage or serve them through a server endpoint that validates a signed access token for every download. Do not upload confidential PDFs to a public Blob URL.

## Deploy/check
1. Add the Vercel environment variables.
2. Deploy the branch to a Preview URL.
3. Test an incorrect code, a correct code, reload after unlock, and a returning browser after rotating the code.
4. Verify PDF URLs cannot be opened without authorization before announcing the system as secure.
