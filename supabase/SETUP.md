# Supabase setup for HomeThread

Project: `punorbgwckjyexbbkpvq` (https://punorbgwckjyexbbkpvq.supabase.co). One-time steps.

## 1. Tables, security, storage bucket, allowed users

1. Open `schema.sql` in this folder. Edit the last block: replace `HER-EMAIL@example.com`
   with her real email. Brendan's is already there.
2. Supabase dashboard → **SQL Editor** → New query → paste the whole file → **Run**.
   It's safe to run again later (adding an email, for example).

To add someone later: SQL Editor →
`insert into public.allowed_users (email) values ('name@example.com');`

## 2. Receipt reader (edge function holding the Anthropic key)

Needs the Supabase CLI once, from the repo root:

```
cd C:\Dev\EmbroideryApp
npx supabase login                       # opens the browser once
npx supabase link --project-ref punorbgwckjyexbbkpvq
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # from console.anthropic.com
npx supabase functions deploy read-receipt
```

Redeploy with the last command whenever `supabase/functions/read-receipt/index.ts` changes.

## 3. Auth settings

Dashboard → **Authentication → URL Configuration**:
- **Site URL**: `https://bsimms2.github.io/homethread/`
- **Redirect URLs**: `https://bsimms2.github.io/homethread/**` and `http://localhost:8081/**` for local testing.

Magic links only work for addresses listed here. Email provider is on by default.

## 4. Hosting the site

Hosted on GitHub Pages from the public repo https://github.com/bsimms2/homethread
(branch `gh-pages`). **Live at https://bsimms2.github.io/homethread/**

Publish an update (builds with base path `/homethread`, pushes `gh-pages`):

```
cd C:\Dev\EmbroideryApp
bash tools/deploy_web.sh
```

Live about a minute later; she just refreshes.

## 5. On her phone

Open the URL in Safari → Share → **Add to Home Screen**. It opens full-screen like an
app. Sign in once with the magic link; the session persists.
