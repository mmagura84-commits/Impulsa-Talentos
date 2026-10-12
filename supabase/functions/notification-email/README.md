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
2. **Deploy** (Supabase CLI, project `cmdqlybsgkegolqydmbh`):

   ```bash
   supabase functions deploy notification-email --no-verify-jwt --project-ref cmdqlybsgkegolqydmbh
   supabase secrets set --project-ref cmdqlybsgkegolqydmbh \
     RESEND_API_KEY=re_xxx \
     WEBHOOK_SECRET="$(openssl rand -hex 32)"
   # optional: SITE_URL=https://impulsatalentos.expert
   #           EMAIL_FROM="Impulsa Talentos <partners@impulsatalentos.expert>"
   ```

   `--no-verify-jwt` is intentional: the webhook authenticates with the
   `x-webhook-secret` header instead, and the function refuses anything else.
3. **Webhook**: Dashboard → Database → Webhooks → *Create*:
   - Table `public.notifications`, event **Insert**
   - Type *Supabase Edge Functions* → `notification-email`, method POST
   - HTTP header `x-webhook-secret` = the WEBHOOK_SECRET from step 2

## Check it works

Create any notification for yourself (for example, request verification on a
test company, or have HQ mark a test payment), then open
Dashboard → Edge Functions → notification-email → Logs. Responses:

| Response | Meaning |
| --- | --- |
| `{"sent":true}` | email accepted by Resend |
| `{"skipped":"opted out of application updates"}` | profile switched them off |
| `{"skipped":"no email on profile"}` | profile has no email (or was anonymized) |
| 401 | header missing or wrong secret |
| 502 `email provider refused` | check the Resend key / domain verification |

Retries are safe: each email uses `Idempotency-Key: notification-<id>`.

## Tests

```bash
bun test supabase/functions/notification-email
```
