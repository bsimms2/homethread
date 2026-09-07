-- HomeThread ledger schema. Paste into Supabase → SQL Editor → Run.
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Who may use the app. Anyone can request a magic link with the public key,
-- so every policy below checks the signed-in email against this table.
create table if not exists public.allowed_users (
  email text primary key,
  added_at timestamptz not null default now()
);

create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------------------
-- Ledger tables. Ids are text (UUIDs from the app, or imp-<hash> from imports).
-- Money is integer cents. Dates are YYYY-MM-DD text.

create table if not exists public.customer (
  id text primary key,
  name text not null,
  contact text not null default '',
  notes text not null default '',
  created_at text not null
);

create table if not exists public."order" (
  id text primary key,
  customer_id text,
  customer_name text not null default '',
  status text not null default 'confirmed',
  ordered_on text not null,
  due_on text,
  notes text not null default '',
  created_at text not null,
  updated_at text not null
);

create table if not exists public.order_line (
  id text primary key,
  order_id text not null references public."order"(id) on delete cascade,
  description text not null default '',
  qty integer not null default 1,
  unit_price integer not null default 0,
  unit_cost integer not null default 0,
  stitches integer,
  position integer not null default 0
);

create table if not exists public.payment (
  id text primary key,
  order_id text not null references public."order"(id) on delete cascade,
  amount integer not null,
  method text not null default 'cash',
  received_on text not null,
  note text not null default ''
);

create table if not exists public.expense_category (
  id text primary key,
  name text not null,
  position integer not null default 0
);

create table if not exists public.expense (
  id text primary key,
  vendor text not null default '',
  spent_on text not null,
  amount integer not null default 0,
  tax integer not null default 0,
  category_id text,
  note text not null default '',
  receipt_image_path text,
  extraction_json text,
  created_at text not null
);

create table if not exists public.design (
  id text primary key,
  name text not null,
  stitches integer not null default 0,
  default_price integer not null default 0,
  default_cost integer not null default 0,
  notes text not null default '',
  last_used_at text,
  created_at text not null
);

create table if not exists public.setting (
  key text primary key,
  value text not null
);

create index if not exists idx_line_order on public.order_line (order_id);
create index if not exists idx_payment_order on public.payment (order_id);
create index if not exists idx_order_date on public."order" (ordered_on);
create index if not exists idx_expense_date on public.expense (spent_on);

-- Default categories (fixed ids so two devices can't seed twice).
insert into public.expense_category (id, name, position) values
  ('cat-blanks',    'Blanks & garments',    0),
  ('cat-thread',    'Thread & stabilizer',  1),
  ('cat-machine',   'Machine & equipment',  2),
  ('cat-software',  'Software & designs',   3),
  ('cat-shipping',  'Shipping & packaging', 4),
  ('cat-marketing', 'Marketing',            5),
  ('cat-mileage',   'Mileage & travel',     6),
  ('cat-other',     'Other',                7)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row-level security: allowed, signed-in users get everything; nobody else
-- gets anything. One policy per table, all four verbs.

do $$
declare t text;
begin
  foreach t in array array['allowed_users','customer','order','order_line','payment','expense_category','expense','design','setting']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allowed users" on public.%I', t);
    execute format(
      'create policy "allowed users" on public.%I for all to authenticated using (public.is_allowed()) with check (public.is_allowed())',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Receipt photos: a private bucket, same allowlist rule.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "allowed users read receipts" on storage.objects;
drop policy if exists "allowed users write receipts" on storage.objects;
create policy "allowed users read receipts" on storage.objects
  for select to authenticated using (bucket_id = 'receipts' and public.is_allowed());
create policy "allowed users write receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts' and public.is_allowed());

-- ---------------------------------------------------------------------------
