create table public.groups (
  id uuid primary key,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

create table public.group_access (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_members (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null
);

create table public.group_expenses (
  id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 80),
  amount integer not null check (amount > 0),
  paid_by_member_id uuid not null references public.group_members (id),
  date date not null,
  kind text not null check (kind in ('expense', 'settlement')),
  created_at timestamptz not null
);

create table public.expense_splits (
  expense_id uuid not null references public.group_expenses (id) on delete cascade,
  member_id uuid not null references public.group_members (id),
  amount integer not null check (amount >= 0),
  primary key (expense_id, member_id)
);

create index group_access_user_id_idx on public.group_access (user_id);
create index group_members_group_id_idx on public.group_members (group_id);
create index group_expenses_group_id_idx on public.group_expenses (group_id);
create index expense_splits_member_id_idx on public.expense_splits (member_id);

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_access access
    where access.group_id = p_group_id
      and access.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

alter table public.groups enable row level security;
alter table public.group_access enable row level security;
alter table public.group_members enable row level security;
alter table public.group_expenses enable row level security;
alter table public.expense_splits enable row level security;

grant select, update, delete on public.groups to authenticated;
grant select on public.group_access to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.group_expenses to authenticated;
grant select, insert, update, delete on public.expense_splits to authenticated;

create policy "Group members can read their groups"
  on public.groups for select to authenticated
  using (public.is_group_member(id));

create policy "Group owners can update their groups"
  on public.groups for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Group owners can delete their groups"
  on public.groups for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "Members can read group access"
  on public.group_access for select to authenticated
  using (user_id = (select auth.uid()) or public.is_group_member(group_id));

create policy "Group members can manage participants"
  on public.group_members for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Group members can manage expenses"
  on public.group_expenses for all to authenticated
  using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

create policy "Group members can manage expense splits"
  on public.expense_splits for all to authenticated
  using (
    exists (
      select 1
      from public.group_expenses expense
      where expense.id = expense_id
        and public.is_group_member(expense.group_id)
    )
  )
  with check (
    exists (
      select 1
      from public.group_expenses expense
      where expense.id = expense_id
        and public.is_group_member(expense.group_id)
    )
  );

create or replace function public.create_shared_group(
  p_group_id uuid,
  p_name text,
  p_created_at timestamptz,
  p_members jsonb
)
returns table (group_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_invite_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a shared group.';
  end if;
  if p_members is null or jsonb_typeof(p_members) is distinct from 'array' then
    raise exception 'A shared group must include at least two members.';
  end if;
  if jsonb_array_length(p_members) < 2 then
    raise exception 'A shared group must include at least two members.';
  end if;

  insert into public.groups (id, name, created_by, created_at)
  values (p_group_id, btrim(p_name), (select auth.uid()), p_created_at)
  on conflict (id) do update set name = excluded.name
    where public.groups.created_by = (select auth.uid())
  returning public.groups.invite_code into generated_invite_code;

  if generated_invite_code is null then
    raise exception 'This group ID is already owned by another account.';
  end if;

  insert into public.group_access (group_id, user_id, role)
  values (p_group_id, (select auth.uid()), 'owner')
  on conflict (group_id, user_id) do update set role = 'owner';

  insert into public.group_members (id, group_id, name, created_at)
  select
    (member->>'id')::uuid,
    p_group_id,
    btrim(member->>'name'),
    (member->>'created_at')::timestamptz
  from jsonb_array_elements(p_members) as member
  on conflict (id) do update set name = excluded.name
    where public.group_members.group_id = p_group_id;

  return query select p_group_id, generated_invite_code;
end;
$$;

create or replace function public.join_group_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before accepting a group invitation.';
  end if;

  select id into target_group_id
  from public.groups
  where invite_code = p_invite_code;

  if target_group_id is null then
    raise exception 'This group invitation is invalid.';
  end if;

  insert into public.group_access (group_id, user_id, role)
  values (target_group_id, (select auth.uid()), 'member')
  on conflict (group_id, user_id) do nothing;

  return target_group_id;
end;
$$;

revoke all on function public.create_shared_group(uuid, text, timestamptz, jsonb) from public;
revoke all on function public.join_group_by_invite(text) from public;
grant execute on function public.create_shared_group(uuid, text, timestamptz, jsonb) to authenticated;
grant execute on function public.join_group_by_invite(text) to authenticated;

alter publication supabase_realtime add table
  public.group_access,
  public.groups,
  public.group_members,
  public.group_expenses,
  public.expense_splits;
