alter table public.members enable row level security;
alter table public.suggestions enable row level security;

drop policy if exists members_select_all on public.members;
drop policy if exists members_insert_all on public.members;
drop policy if exists members_update_all on public.members;
drop policy if exists members_delete_all on public.members;
drop policy if exists suggestions_select_all on public.suggestions;
drop policy if exists suggestions_insert_all on public.suggestions;
drop policy if exists suggestions_update_all on public.suggestions;
drop policy if exists suggestions_delete_all on public.suggestions;

create policy members_select_all on public.members for select to anon, authenticated using (true);
create policy members_insert_all on public.members for insert to anon, authenticated with check (true);
create policy members_update_all on public.members for update to anon, authenticated using (true) with check (true);
create policy members_delete_all on public.members for delete to anon, authenticated using (true);

create policy suggestions_select_all on public.suggestions for select to anon, authenticated using (true);
create policy suggestions_insert_all on public.suggestions for insert to anon, authenticated with check (true);
create policy suggestions_update_all on public.suggestions for update to anon, authenticated using (true) with check (true);
create policy suggestions_delete_all on public.suggestions for delete to anon, authenticated using (true);
