-- Price list, blank inventory, startup flag on expenses, blank/product links on lines.

create table if not exists public.product (
  id text primary key,
  name text not null,
  option text not null default '',
  qty integer not null default 1,
  price integer not null default 0,
  notes text not null default '',
  position integer not null default 0,
  created_at text not null
);

create table if not exists public.blank (
  id text primary key,
  type text not null,
  style text not null default '',
  vendor text not null default '',
  purchased_on text,
  qty integer not null default 0,
  total_cost integer not null default 0,
  unit_cost integer not null default 0,
  adjust integer not null default 0,
  notes text not null default '',
  created_at text not null
);

alter table public.expense add column if not exists is_startup boolean not null default false;
alter table public.order_line add column if not exists blank_id text;
alter table public.order_line add column if not exists product_id text;

do $$
declare t text;
begin
  foreach t in array array['product','blank']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "allowed users" on public.%I', t);
    execute format(
      'create policy "allowed users" on public.%I for all to authenticated using (public.is_allowed()) with check (public.is_allowed())',
      t
    );
  end loop;
end $$;
