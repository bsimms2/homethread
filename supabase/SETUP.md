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
- **Site URL**: the address the site is hosted at (e.g. `https://homethread.pages.dev`).
- **Redirect URLs**: add the same address, and `http://localhost:8081` for local testing.

Magic links only work for addresses listed here. Email provider is on by default.

## 4. Hosting the site

The app is a static site: `apps/mobile/dist/` after

```
cd C:\Dev\EmbroideryApp\apps\mobile
npx expo export --platform web
```

Any static host works. Cloudflare Pages or Netlify: create a project, drag the `dist`
folder in, done. Updates = export again, drag again (or wire the CLI). Then put the
resulting URL in step 3.

## 5. On her phone

Open the URL in Safari → Share → **Add to Home Screen**. It opens full-screen like an
app. Sign in once with the magic link; the session persists.
