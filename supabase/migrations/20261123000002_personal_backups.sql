-- Optional, private, explicit-action backups. This does not migrate local data automatically.
create table public.personal_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.personal_backups enable row level security;
grant select, insert, update, delete on public.personal_backups to authenticated;
create policy "Users manage only their private backup"
  on public.personal_backups for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create function public.get_personal_backup(p_expected_user_id uuid)
returns table(document jsonb, revision integer, updated_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
    raise exception 'Your account changed. Reopen private backup for the current account.';
  end if;
  return query select backup.document, backup.revision, backup.updated_at
  from public.personal_backups backup where backup.user_id = (select auth.uid());
end;
$$;

create function public.save_personal_backup(p_expected_user_id uuid, p_document jsonb, p_expected_revision integer)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  current_backup public.personal_backups%rowtype;
  next_revision integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
    raise exception 'Your account changed. Reopen private backup for the current account.';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'A valid expected backup revision is required.';
  end if;
  if p_document is null or jsonb_typeof(p_document) <> 'object' or pg_column_size(p_document) > 5242880 then
    raise exception 'Choose a valid backup object smaller than 5 MB.';
  end if;

  -- Serialize first uploads as well as subsequent updates for this account.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into current_backup from public.personal_backups
  where user_id = (select auth.uid()) for update;
  if found and current_backup.document = p_document then return current_backup.revision; end if;
  if coalesce(current_backup.revision, 0) <> p_expected_revision then
    raise exception 'The cloud backup changed. Download and review it before replacing it.'
      using errcode = '40001';
  end if;
  next_revision := p_expected_revision + 1;
  insert into public.personal_backups(user_id, document, revision)
  values ((select auth.uid()), p_document, next_revision)
  on conflict (user_id) do update
    set document = excluded.document, revision = excluded.revision, updated_at = now();
  return next_revision;
end;
$$;

create function public.delete_personal_backup(p_expected_user_id uuid, p_expected_revision integer)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare current_revision integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
    raise exception 'Your account changed. Reopen private backup for the current account.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select revision into current_revision from public.personal_backups where user_id = (select auth.uid());
  if current_revision is null then return false; end if;
  if current_revision is distinct from p_expected_revision then
    raise exception 'The backup changed. Review the latest cloud copy before deleting it.';
  end if;
  delete from public.personal_backups where user_id = (select auth.uid());
  return true;
end;
$$;

revoke all on function public.get_personal_backup(uuid) from public;
revoke all on function public.save_personal_backup(uuid, jsonb, integer) from public;
revoke all on function public.delete_personal_backup(uuid, integer) from public;
grant execute on function public.get_personal_backup(uuid) to authenticated;
grant execute on function public.save_personal_backup(uuid, jsonb, integer) to authenticated;
grant execute on function public.delete_personal_backup(uuid, integer) to authenticated;
