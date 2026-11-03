# Teamflow JaaS meeting access

The static GitHub Pages client requests a room-scoped RS256 JWT from `teamflow-video`. The PEM private key stays in Supabase Edge Function secrets. Required names: `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY`. PKCS8 and PKCS1 RSA private keys are accepted. Never commit secrets or sample JWTs.

Apply `supabase/jaas.sql` once before deploying the function with JWT gateway verification off: this workspace intentionally permits guest access without accounts, like the existing sync/board functions. The function permits only rooms already saved in the shared workspace, rejects unapproved browser origins, and uses a service-role-only, transaction-locked allocation ledger. CORS is not authentication. Anyone able to access this public workspace and its meeting links can request a meeting credential. All guests are moderators; names are not verified identities.

Cloud recording, transcription, livestreaming and telephony are disabled in signed permissions, with recording controls hidden in the provider toolbar. Teamflow's independent local helper handles recording, subject to the recording device/browser's capabilities.

The application caps **new Teamflow device IDs at 20 per UTC calendar month**, with at most 1200 token issues per ID/month. This conservative local cap is NOT JaaS billing enforcement: the provider counts browser/device storage identifiers independently, and deleting provider storage can create another provider MAU without changing the Teamflow ID. Check the provider Activity and free plan, do not enable paid extras or payment/overages if zero charges are required. No provider billing settings were changed by this implementation.

GET returns only configuration/signing readiness. POST `{room, deviceId}` returns `{jwt,appId,expiresAt}` with `no-store`. Tokens match a single room and expire after four hours (join/rejoin credential window, not a four-hour room timeout). Provider-level acceptance and actual meeting continuity require browser checks.

Validation: real secret signing readiness, token issuance and claims, unknown-room rejection, transactional quota rejection with rollback, no direct client table permissions, and Supabase security advisors. Do not log returned tokens.
