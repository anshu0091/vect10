# Migrating to a New Supabase Account

Follow these steps to point the app at a new Supabase project.

## 1. Create the new Supabase project

1. Log in at [supabase.com](https://supabase.com) with your **new** account.
2. Click **New project**.
3. Choose organization, name, database password, and region. Save the password.
4. Wait for the project to be ready.

## 2. Get the new project credentials

1. In the new project, go to **Project Settings** (gear icon) → **API**.
2. Copy:
   - **Project URL** (e.g. `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## 3. Apply database schema on the new project

Your app expects these tables and features: `profiles`, `carbon_credits`, `user_carbon_credits`, `transactions`, triggers, and RLS policies. Apply them in this order:

**Option A – Supabase Dashboard (recommended)**

1. In the new project, open **SQL Editor**.
2. Run each migration file in order (oldest first):
   - `supabase/migrations/20250227114233_sweet_surf.sql` (profiles + trigger)
   - `supabase/migrations/20250228104943_peaceful_desert.sql` (if needed; may duplicate profiles)
   - `supabase/migrations/20250617145258_shy_credit.sql` (carbon_credits, user_carbon_credits, transactions, sample data)
   - `supabase/migrations/20250618080358_pink_glitter.sql` (functions)
   - `supabase/migrations/20250620120000_add_balance_to_profiles.sql` (balance on profiles)

**Option B – Supabase CLI (recommended)**

1. Install dependencies and link the remote project:

```bash
npm install
npm run db:link
```

When prompted, enter:
- **Project ref**: the ref from your project URL (e.g. from `https://qrqvekyzdfshupvvcxni.supabase.co` use `qrqvekyzdfshupvvcxni`)
- **Database password**: the password you set when creating the project

2. Push migrations to the remote database:

```bash
npm run db:push
```

This runs all files in `supabase/migrations/` in order. If you see an error about an object already existing (e.g. trigger `on_auth_user_created`), it’s likely from the duplicate migration `20250228104943_peaceful_desert.sql`. You can remove or rename that file and run `db:push` again, or run migrations manually in the Dashboard (Option A) instead.

## 4. Point the app at the new project

1. Open `.env` in the project root.
2. Replace the Supabase values with the new project’s:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_NEW_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_new_anon_key_here
```

3. Restart the dev server: `npm run dev`.

## 5. (Optional) Migrate existing data

If you need users or data from the **old** project:

- **Auth users**: Supabase Dashboard → Authentication → Users → export or re-invite users to sign up in the new project.
- **Table data**: Use Dashboard → Table Editor to export CSV, or use the SQL Editor to run `COPY ... TO STDOUT` / pg_dump, then import into the new project.

## 6. Configure Auth (if you use email redirects)

In the new project:

1. Go to **Authentication** → **URL Configuration**.
2. Set **Site URL** to your app URL (e.g. `http://localhost:3000` for dev).
3. Add **Redirect URLs** (e.g. `http://localhost:3000/auth/callback`).

---

After this, the app uses the new Supabase account. Keep the old project’s URL and anon key only if you need to reference or migrate from it later.
