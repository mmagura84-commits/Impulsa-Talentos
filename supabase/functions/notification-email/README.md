# notification-email

Sends an email for every row inserted into `public.notifications`, to the
person the notification belongs to, in their `preferred_language` (es/en/pt).
"Application updates" emails are skipped when the profile switched them off
(`notification_prefs.applicationUpdates = false`). Account, billing and HQ
emails are always sent.

Why: the production site is static, so the app's server email code never runs
there. Migration 041 makes the database create a notification at every
hand-off; this function turns each one into an email.

## Setup (once, after migration 041 is live)

1. **Resend**: verify the domain `impulsatalentos.expert` (SPF + DKIM records)
   and create an API key with "sending access".
2. **Deploy** with JWT verification ON (dashboard editor, or the CLI):

   ```bash
   supabase functions deploy notification-email --project-ref cmdqlybsgkegolqydmbh
   supabase secrets set --project-ref cmdqlybsgkegolqydmbh RESEND_API_KEY=re_xxx
   # optional: SITE_URL, EMAIL_FROM
   ```
3. **Webhook**: Dashboard → Integrations → Database Webhooks → *Create*:
   - Table `public.notifications`, event **Insert**
   - Type *Supabase Edge Functions* → `notification-email`, method POST
   - Click **Add auth header with service key** (the function only accepts
     callers holding the service role; browsers never have it)

   Alternative: set a `WEBHOOK_SECRET` secret and send it as the
   `x-webhook-secret` header instead.

## Check it works

Create any notification for yourself (for example, request verification on a
test company, or have HQ mark a test payment), then open
Dashboard → Edge Functions → notification-email → Logs. Responses:

| Response | Meaning |
| --- | --- |
| `{"sent":true}` | email accepted by Resend |
| `{"skipped":"opted out of application updates"}` | profile switched them off |
| `{"skipped":"no email on profile"}` | profile has no email (or was anonymized) |
| 401 | no service-role auth header (or wrong `x-webhook-secret`) |
| 502 `email provider refused` | check the Resend key / domain verification |

Retries are safe: each email uses `Idempotency-Key: notification-<id>`.

## Tests

```bash
bun test supabase/functions/notification-email
```
