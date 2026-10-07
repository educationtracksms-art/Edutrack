# Vercel Environment Setup

This app reads Supabase credentials from the server runtime, so Vercel must have the
same values configured in the project settings.

## Required variables

Add these in **Vercel → Project → Settings → Environment Variables**:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Authenticated server functions share a Supabase Postgres-backed limit of 120
requests per user per minute. Apply the `server_function_rate_limits` migration
to the Supabase project before deploying. The limit is enforced atomically by a
database function; no Redis service or additional environment variables are
required. Rejected requests return HTTP 429 with a `Retry-After` header. If the
Supabase rate-limit check fails, requests fail closed with HTTP 503.

Use the correct environment scope:

- **Production** for the live site
- **Preview** for preview deployments
- **Development** only if you want `vercel dev` to use them

## Important

- Changes to Vercel environment variables only apply to new deployments.
- After adding or updating the variables, redeploy the project.
- Keep `SUPABASE_SERVICE_ROLE_KEY` private and mark it sensitive in Vercel.

## Local sync

If you want local development to match Vercel, run:

```bash
vercel env pull
```

That pulls the Vercel project variables into your local `.env.local` file.
