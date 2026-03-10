create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique not null,
  username text unique not null,
  password text not null,
  start_date date not null,
  duration_months integer not null check (duration_months > 0),
  end_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  suggestion text not null,
  created_at timestamptz not null default now()
);

create index if not exists members_username_idx on public.members(username);
create index if not exists suggestions_member_id_idx on public.suggestions(member_id);
create index if not exists suggestions_created_at_idx on public.suggestions(created_at desc);
