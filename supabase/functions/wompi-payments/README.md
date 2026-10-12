# wompi-payments

Instant card payments for job credits. The employer pays on Wompi's hosted
checkout; when Wompi confirms, the credits are added straight away (no HQ
step) and any job waiting for credits goes live. Bank transfer stays available.

Off until configured: the "Pay by card" button only appears once the three
secrets below are set **and** the plan has a peso price.

## Turn it on

1. **Wompi merchant account** (wompi.co): company NIT + Colombian bank account.
   From *Developers* copy the **public key**, **integrity secret** and
   **events secret** (production).
2. **Peso prices** (Wompi charges COP only). In the SQL editor, per plan, in
   cents (COP 390.000 = `39000000`):

   ```sql
   update public.billing_packages set amount_cop_cents = 39000000 where id = 'pro';
   update public.billing_packages set amount_cop_cents = 390000000 where id = 'pro_yearly';
   -- premium, premium_yearly likewise
   ```
3. **Deploy** with JWT verification off (Wompi's server has no Supabase token):

   ```bash
   supabase functions deploy wompi-payments --no-verify-jwt --project-ref cmdqlybsgkegolqydmbh
   ```
4. **Secrets** (Dashboard → Edge Functions → Secrets — paste them yourself):
   `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`.
5. **Events URL** in Wompi → Developers:
   `https://cmdqlybsgkegolqydmbh.supabase.co/functions/v1/wompi-payments`

## How it stays safe

- The order and price come from the database (`start_card_payment`, run as the
  signed-in employer, who must belong to the company).
- Checkout carries Wompi's integrity signature, so the amount can't be edited.
- Events are accepted only if Wompi's checksum matches the events secret, and
  only `apply_card_payment` (service role) can grant credits. A paid amount that
  doesn't match the order is marked `error` and never granted; replays are ignored.

## Tests

```bash
bun test supabase/functions/wompi-payments   # signing + event checks
supabase/tests/run_tests.sh -h /tmp -p 55432 -U postgres   # database rules
```
