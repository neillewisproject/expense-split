-- Additive upgrade only. Review and apply manually; never infer legacy authors.
alter table public.groups add column invite_expires_at timestamptz not null default (now() + interval '7 days');
alter table public.group_expenses drop constraint group_expenses_kind_check;
alter table public.group_expenses add constraint group_expenses_kind_check check (kind in ('expense','settlement','refund'));
alter table public.group_expenses add column refund_of_id uuid references public.group_expenses(id);
alter table public.group_expenses add column refund_snapshot jsonb;
create index group_refund_original_idx on public.group_expenses(refund_of_id);

alter function public.group_ledger_snapshot(uuid) rename to group_ledger_snapshot_before_collaboration;
create function public.group_ledger_snapshot(p_group_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.group_ledger_snapshot_before_collaboration(p_group_id) ||
    jsonb_build_object(
      'inviteExpiresAt',to_char(g.invite_expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'expenses',coalesce((
        select jsonb_agg(entry || jsonb_build_object('refundOfId',e.refund_of_id,'refundSnapshot',e.refund_snapshot) order by ordinal)
        from jsonb_array_elements(public.group_ledger_snapshot_before_collaboration(p_group_id)->'expenses') with ordinality x(entry,ordinal)
        join public.group_expenses e on e.id=(entry->>'id')::uuid
      ),'[]'::jsonb)
    )
  from public.groups g where g.id=p_group_id;
$$;
revoke all on function public.group_ledger_snapshot(uuid) from public,authenticated;

create or replace function public.get_shared_group_snapshots(p_expected_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  return (select coalesce(jsonb_agg(public.group_ledger_snapshot(a.group_id)),'[]'::jsonb)
    from public.group_access a where a.user_id=auth.uid());
end;
$$;

create function public.assert_group_refund_ledger(p_group_id uuid,p_before jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.group_expenses%rowtype;
  original public.group_expenses%rowtype;
  old jsonb;
  old_original jsonb;
  original_split jsonb;
  original_source_split jsonb;
  original_source_payers jsonb;
  source_currency text;
  historical_rate text;
  source_total bigint;
  source_left bigint;
  base_left bigint;
  source_used bigint;
  base_used bigint;
  source_exponent integer;
  base_exponent integer;
  source_amount bigint;
  converted bigint;
  expected_amount bigint;
  remaining_parts jsonb;
  allocation jsonb;
  expected_parts jsonb;
  pair record;
  consumed bigint;
  is_changed boolean;
  actor uuid := auth.uid();
begin
  if exists(select 1 from public.group_expenses where group_id=p_group_id and kind<>'refund' and (refund_of_id is not null or refund_snapshot is not null)) then
    raise exception 'Only refunds can link to an original expense.';
  end if;
  for old_original in select value from jsonb_array_elements(coalesce(p_before->'expenses','[]'::jsonb)) loop
    if old_original->>'kind'='refund' and not exists(select 1 from public.group_expenses where id=(old_original->>'id')::uuid and group_id=p_group_id and kind='refund' and refund_of_id=(old_original->>'refundOfId')::uuid) then
      raise exception 'Refund links and kinds cannot change.';
    end if;
    if exists(select 1 from public.group_expenses where group_id=p_group_id and refund_of_id=(old_original->>'id')::uuid) then
      select * into original from public.group_expenses where id=(old_original->>'id')::uuid and group_id=p_group_id;
      select coalesce(jsonb_object_agg(member_id::text,amount),'{}'::jsonb) into original_split from public.expense_splits where expense_id=original.id;
      if original.kind is distinct from old_original->>'kind' or original.amount is distinct from (old_original->>'amount')::integer or
        original.paid_by_member_id is distinct from (old_original->>'paidBy')::uuid or original.currency is distinct from old_original->>'currency' or
        original.contributions is distinct from old_original->'contributions' or original_split is distinct from old_original->'split' or
        original.conversion is distinct from nullif(old_original->'conversion','null'::jsonb) then
        raise exception 'An expense with refund history cannot change financial allocations or exchange rate.';
      end if;
    end if;
  end loop;
  for r in select * from public.group_expenses where group_id=p_group_id and kind='refund' loop
    select * into original from public.group_expenses where id=r.refund_of_id and group_id=p_group_id and kind='expense';
    if not found or jsonb_typeof(r.refund_snapshot) is distinct from 'object' then raise exception 'Every refund must link to an original group expense.'; end if;
    if r.conversion is not null or r.split_inputs is not null or r.itemized is not null then raise exception 'Refund allocations must be derived from the original ledger.'; end if;
    select value into old from jsonb_array_elements(coalesce(p_before->'expenses','[]'::jsonb)) where (value->>'id')::uuid=r.id;
    if old is not null and ((old->>'refundOfId')::uuid is distinct from r.refund_of_id or old->>'kind'<>'refund') then raise exception 'Refund links and kinds cannot change.'; end if;
    if old is null and original.author_id is distinct from actor and not exists(select 1 from public.groups where id=p_group_id and created_by=actor) then
      raise exception 'Only the original author or owner can record a linked refund.';
    end if;
    if old is null and r.deleted_at is not null then raise exception 'Record an active refund before voiding it.'; end if;
    if r.amount>original.amount then raise exception 'Refund exceeds its original base amount.'; end if;
    source_currency:=coalesce(original.conversion->>'originalCurrency',original.currency);
    historical_rate:=coalesce(original.conversion->>'rate','1');
    source_total:=coalesce((original.conversion->>'originalAmount')::bigint,original.amount);
    source_exponent:=coalesce((original.conversion->>'originalExponent')::integer,(r.refund_snapshot->>'sourceExponent')::integer);
    base_exponent:=coalesce((original.conversion->>'baseExponent')::integer,(r.refund_snapshot->>'baseExponent')::integer);
    if jsonb_typeof(r.refund_snapshot->'sourceAmount') is distinct from 'number' or r.refund_snapshot->>'sourceAmount' !~ '^[0-9]+$' or
      jsonb_typeof(r.refund_snapshot->'sourceExponent') is distinct from 'number' or r.refund_snapshot->>'sourceExponent' !~ '^[0-3]$' or
      jsonb_typeof(r.refund_snapshot->'baseExponent') is distinct from 'number' or r.refund_snapshot->>'baseExponent' !~ '^[0-3]$' or
      jsonb_typeof(r.refund_snapshot->'baseRoundingAdjustment') is distinct from 'number' or r.refund_snapshot->>'baseRoundingAdjustment' !~ '^-?[0-9]+$' or
      r.refund_snapshot->>'sourceCurrency' is distinct from source_currency or r.refund_snapshot->>'rate' is distinct from historical_rate or
      (r.refund_snapshot->>'sourceExponent')::integer is distinct from source_exponent or
      (r.refund_snapshot->>'baseExponent')::integer is distinct from base_exponent or
      (original.conversion is null and source_exponent is distinct from base_exponent) then raise exception 'Refunds must retain the original historical currency and exchange rate.'; end if;
    source_amount:=(r.refund_snapshot->>'sourceAmount')::bigint;
    if source_amount<=0 or source_amount>source_total then raise exception 'Invalid refund source amount.'; end if;
    converted:=round(source_amount*historical_rate::numeric*power(10::numeric,base_exponent-source_exponent))::bigint;
    if r.amount-converted<>(r.refund_snapshot->>'baseRoundingAdjustment')::bigint then raise exception 'Invalid historical refund rounding adjustment.'; end if;
    foreach allocation in array array[r.refund_snapshot->'sourceSplit',r.refund_snapshot->'sourceContributions'] loop
      if jsonb_typeof(allocation) is distinct from 'object' or exists(select 1 from jsonb_each(allocation) where jsonb_typeof(value)<>'number') then raise exception 'Invalid refund source allocations.'; end if;
      consumed:=0;
      for pair in select key,value from jsonb_each_text(allocation) loop
        if pair.value !~ '^[0-9]+$' or not exists(select 1 from public.group_members where id=pair.key::uuid and group_id=p_group_id) then raise exception 'Refund source allocations reference another group.'; end if;
        consumed:=consumed+pair.value::bigint;
      end loop;
      if consumed<>source_amount then raise exception 'Refund source allocations must sum to the source amount.'; end if;
    end loop;
    if r.deleted_at is not null then
      if old is not null and (old->'amount' is distinct from to_jsonb(r.amount) or old->'refundSnapshot' is distinct from r.refund_snapshot or old->'contributions' is distinct from r.contributions or
        old->'split' is distinct from (select coalesce(jsonb_object_agg(member_id::text,amount),'{}'::jsonb) from public.expense_splits where expense_id=r.id)) then
        raise exception 'Restore a voided refund before editing its financial allocations.';
      end if;
      continue;
    end if;
    if original.deleted_at is not null then raise exception 'Void active refunds before deleting the original expense.'; end if;
    select coalesce(sum(amount),0),coalesce(sum((refund_snapshot->>'sourceAmount')::bigint),0) into base_used,source_used
      from public.group_expenses where group_id=p_group_id and refund_of_id=original.id and deleted_at is null and kind='refund';
    if base_used>original.amount or source_used>source_total or ((base_used=original.amount) is distinct from (source_used=source_total)) then raise exception 'Refunds cannot exceed or strand original/base amounts.'; end if;
    select coalesce(jsonb_object_agg(member_id::text,amount),'{}'::jsonb) into original_split from public.expense_splits where expense_id=original.id;
    original_source_split:=coalesce(original.conversion->'originalSplit',original_split);
    original_source_payers:=coalesce(original.conversion->'originalContributions',original.contributions);
    -- Four independent capped budgets: base paid/owed and original paid/owed.
    for pair in select * from (values
      ('base_split',original_split),('base_payers',original.contributions),
      ('source_split',original_source_split),('source_payers',original_source_payers)
    ) budgets(name,parts) loop
      if pair.name='base_split' then
        select coalesce(jsonb_object_agg(member_id::text,amount),'{}'::jsonb) into allocation from public.expense_splits where expense_id=r.id;
      elsif pair.name='base_payers' then allocation:=r.contributions;
      elsif pair.name='source_split' then allocation:=r.refund_snapshot->'sourceSplit';
      else allocation:=r.refund_snapshot->'sourceContributions'; end if;
      if exists(select 1 from jsonb_each_text(allocation) where value::bigint>0 and not pair.parts ? key) then raise exception 'Refund allocations must preserve original participants.'; end if;
      remaining_parts:='{}'::jsonb;
      for old_original in select jsonb_build_object('id',key,'amount',value) from jsonb_each_text(pair.parts) loop
        if pair.name='base_split' then
          select coalesce(sum(s.amount),0) into consumed from public.expense_splits s join public.group_expenses e on e.id=s.expense_id
            where e.group_id=p_group_id and e.refund_of_id=original.id and e.deleted_at is null and e.id<>r.id and s.member_id=(old_original->>'id')::uuid;
        elsif pair.name='base_payers' then
          select coalesce(sum((contributions->>(old_original->>'id'))::bigint),0) into consumed from public.group_expenses
            where group_id=p_group_id and refund_of_id=original.id and deleted_at is null and id<>r.id;
        else
          select coalesce(sum((refund_snapshot->(case when pair.name='source_split' then 'sourceSplit' else 'sourceContributions' end)->>(old_original->>'id'))::bigint),0)
            into consumed from public.group_expenses where group_id=p_group_id and refund_of_id=original.id and deleted_at is null and id<>r.id;
        end if;
        if consumed+coalesce((allocation->>(old_original->>'id'))::bigint,0)>(old_original->>'amount')::bigint then raise exception 'Refund exceeds a participant remaining allocation.'; end if;
        remaining_parts:=jsonb_set(remaining_parts,array[old_original->>'id'],to_jsonb((old_original->>'amount')::bigint-consumed));
      end loop;
      is_changed:=old is null or old->'amount' is distinct from to_jsonb(r.amount) or
        old->'refundSnapshot' is distinct from r.refund_snapshot or old->'contributions' is distinct from r.contributions or
        old->'split' is distinct from (select coalesce(jsonb_object_agg(member_id::text,amount),'{}'::jsonb) from public.expense_splits where expense_id=r.id);
      if is_changed then
        perform public.assert_group_allocation(
          case when pair.name like 'source_%' then source_amount else r.amount end,
          jsonb_build_object('mode','shares','memberIds',(select jsonb_agg(key order by key) from jsonb_each(remaining_parts)),'values',remaining_parts),null,allocation);
      end if;
    end loop;
    if old is null or old->'amount' is distinct from to_jsonb(r.amount) or old->'refundSnapshot' is distinct from r.refund_snapshot then
      base_left:=original.amount-(base_used-r.amount);
      source_left:=source_total-(source_used-source_amount);
      expected_amount:=case when source_amount=source_left then base_left else converted end;
      if r.amount<>expected_amount or (source_amount<source_left and r.amount>=base_left) then raise exception 'Partial refund cannot be represented safely in base minor units.'; end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.assert_group_refund_ledger(uuid,jsonb) from public,authenticated;

-- Reuse the audited revision protocol for ordinary entries, but keep true refund
-- kinds in committed rows and in immutable before/after receipts.
alter function public.apply_group_operation(uuid,uuid,uuid,integer,jsonb) rename to apply_group_operation_before_collaboration;
revoke all on function public.apply_group_operation_before_collaboration(uuid,uuid,uuid,integer,jsonb) from public,authenticated;
create function public.apply_group_operation(
  p_expected_user_id uuid,p_operation_id uuid,p_group_id uuid,p_base_revision integer,p_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare before_data jsonb; core_snapshot jsonb; entry jsonb; result jsonb; receipt public.group_operation_receipts%rowtype;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_group_id::text,0));
  if exists(select 1 from public.groups where id=p_group_id) and not public.is_group_member(p_group_id) then raise exception 'Shared group access is unavailable.'; end if;
  select * into receipt from public.group_operation_receipts where id=p_operation_id;
  if found then
    if receipt.actor_id<>auth.uid() or receipt.group_id<>p_group_id or receipt.snapshot_hash<>md5(p_snapshot::text) then raise exception 'Operation ID cannot be reused with different content.'; end if;
    if not public.is_group_member(p_group_id) then raise exception 'Shared group access is unavailable.'; end if;
    return jsonb_build_object('revision',receipt.revision,'inviteCode',(select invite_code from public.groups where id=p_group_id));
  end if;
  before_data:=public.group_ledger_snapshot(p_group_id);
  if jsonb_typeof(p_snapshot->'expenses') is distinct from 'array' then raise exception 'Invalid full group snapshot.'; end if;
  if exists(select 1 from jsonb_array_elements(p_snapshot->'expenses') x where x->>'kind' not in ('expense','settlement','refund')) then raise exception 'Unsupported entry kind.'; end if;
  core_snapshot:=jsonb_set(p_snapshot,'{expenses}',coalesce((
    select jsonb_agg(x || jsonb_build_object(
      'kind',case when x->>'kind'='refund' then 'expense' else x->>'kind' end,
      'refundOfId',coalesce(x->'refundOfId','null'::jsonb),'refundSnapshot',coalesce(x->'refundSnapshot','null'::jsonb)
    ) order by ordinal) from jsonb_array_elements(p_snapshot->'expenses') with ordinality e(x,ordinal)
  ),'[]'::jsonb));
  update public.group_expenses set kind='expense' where group_id=p_group_id and kind='refund';
  result:=public.apply_group_operation_before_collaboration(p_expected_user_id,p_operation_id,p_group_id,p_base_revision,core_snapshot);
  for entry in select value from jsonb_array_elements(p_snapshot->'expenses') loop
    update public.group_expenses set kind=entry->>'kind',refund_of_id=(entry->>'refundOfId')::uuid,refund_snapshot=nullif(entry->'refundSnapshot','null'::jsonb)
      where id=(entry->>'id')::uuid and group_id=p_group_id;
  end loop;
  perform public.assert_group_refund_ledger(p_group_id,before_data);
  update public.group_operation_receipts set snapshot_hash=md5(p_snapshot::text),before_snapshot=before_data,after_snapshot=public.group_ledger_snapshot(p_group_id) where id=p_operation_id;
  return result;
end;
$$;
revoke all on function public.apply_group_operation(uuid,uuid,uuid,integer,jsonb) from public;
grant execute on function public.apply_group_operation(uuid,uuid,uuid,integer,jsonb) to authenticated;

create table public.group_administrative_operations (
  id uuid primary key,
  group_id uuid not null references public.groups(id),
  actor_id uuid not null references auth.users(id),
  request_hash text not null,
  action text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.group_administrative_operations enable row level security;
revoke all on public.group_administrative_operations from public,authenticated;
grant select on public.group_administrative_operations to authenticated;
create policy "Actors read authorized administrative receipts" on public.group_administrative_operations
for select to authenticated using (actor_id=auth.uid() and public.is_group_member(group_id));

create function public.group_administration_snapshot(p_group_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('snapshot',public.group_ledger_snapshot(p_group_id),'access',coalesce((
    select jsonb_agg(jsonb_build_object('userId',a.user_id,'role',a.role,'balance',(
      select case when exists(select 1 from public.group_members where group_id=p_group_id and user_id=a.user_id)
        then coalesce(sum(case when e.kind='refund' then -1 else 1 end *
        (coalesce((e.contributions->>m.id::text)::bigint,0)-coalesce(s.amount,0))),0)::bigint else null end
      from public.group_members m cross join public.group_expenses e
      left join public.expense_splits s on s.expense_id=e.id and s.member_id=m.id
      where m.group_id=p_group_id and m.user_id=a.user_id and e.group_id=p_group_id and e.deleted_at is null
    )) order by a.created_at,a.user_id) from public.group_access a where a.group_id=p_group_id
  ),'[]'::jsonb),'revision',g.revision) from public.groups g where g.id=p_group_id;
$$;
revoke all on function public.group_administration_snapshot(uuid) from public,authenticated;
create function public.get_group_administration(p_expected_user_id uuid,p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  if not public.is_group_member(p_group_id) then raise exception 'Shared group access is unavailable.'; end if;
  return public.group_administration_snapshot(p_group_id);
end;
$$;
revoke all on function public.get_group_administration(uuid,uuid) from public;
grant execute on function public.get_group_administration(uuid,uuid) to authenticated;

create function public.perform_group_administration(
  p_expected_user_id uuid,p_operation_id uuid,p_group_id uuid,p_expected_revision integer,
  p_action text,p_target_user_id uuid,p_expires_in_hours integer,p_acknowledge_ledger boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.groups%rowtype; prior public.group_administrative_operations%rowtype; result jsonb; fingerprint text; actor uuid:=auth.uid(); owner_before uuid;
begin
  if actor is null or actor is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_group_id::text,0));
  fingerprint:=md5(jsonb_build_array(p_group_id,p_expected_revision,p_action,p_target_user_id,p_expires_in_hours,p_acknowledge_ledger)::text);
  select * into prior from public.group_administrative_operations where id=p_operation_id;
  if found then
    if prior.actor_id<>actor or prior.group_id<>p_group_id or prior.request_hash<>fingerprint then raise exception 'Administrative operation ID cannot be reused.'; end if;
    if prior.action<>'leave' and not public.is_group_member(p_group_id) then raise exception 'Shared group access is unavailable.'; end if;
    return prior.response;
  end if;
  select * into g from public.groups where id=p_group_id for update;
  if not found or not public.is_group_member(p_group_id) then raise exception 'Shared group access is unavailable.'; end if;
  if g.revision is distinct from p_expected_revision then raise exception 'REVISION_CONFLICT: refresh the shared ledger before administering access.'; end if;
  owner_before:=g.created_by;
  if p_action<>'leave' and g.created_by<>actor then raise exception 'Only the owner can administer group access and invites.'; end if;
  if p_action='rotate' then
    if p_expires_in_hours is null or p_expires_in_hours not between 1 and 720 then raise exception 'Choose an invite lifetime from 1 to 720 hours.'; end if;
    update public.groups set invite_code=gen_random_uuid()::text,invite_expires_at=now()+make_interval(hours=>p_expires_in_hours) where id=p_group_id;
  elsif p_action='transfer' then
    if p_target_user_id is null or p_target_user_id=actor or not exists(select 1 from public.group_access where group_id=p_group_id and user_id=p_target_user_id) then raise exception 'Choose another account already in this group.'; end if;
    update public.group_access set role='member' where group_id=p_group_id;
    update public.group_access set role='owner' where group_id=p_group_id and user_id=p_target_user_id;
    update public.groups set created_by=p_target_user_id where id=p_group_id;
  elsif p_action in ('remove','leave') then
    if p_acknowledge_ledger is distinct from true then raise exception 'Acknowledge that participants, debt and accounting history remain.'; end if;
    if p_action='leave' then p_target_user_id:=actor; end if;
    if p_target_user_id is null or p_target_user_id=g.created_by then raise exception 'Transfer ownership before the owner leaves or is removed.'; end if;
    if not exists(select 1 from public.group_access where group_id=p_group_id and user_id=p_target_user_id) then raise exception 'This account has no current group access.'; end if;
    delete from public.group_access where group_id=p_group_id and user_id=p_target_user_id;
    -- Revoke the current claim, not the named participant or financial references.
    update public.group_members set user_id=null where group_id=p_group_id and user_id=p_target_user_id;
  else raise exception 'Unsupported administrative action.'; end if;
  update public.groups set revision=revision+1 where id=p_group_id returning * into g;
  insert into public.group_activity(id,group_id,actor_id,action,text,details,created_at)
  values(p_operation_id,p_group_id,actor,'access_'||p_action,'',
    jsonb_build_object('previousOwner',owner_before,'newOwner',g.created_by,'target',p_target_user_id,'ledgerPreserved',true)::text,now());
  result:=case when p_action='leave' then jsonb_build_object('snapshot',null,'access','[]'::jsonb,'revision',g.revision)
    else public.group_administration_snapshot(p_group_id) end;
  insert into public.group_administrative_operations(id,group_id,actor_id,request_hash,action,response)
  values(p_operation_id,p_group_id,actor,fingerprint,p_action,result);
  return result;
end;
$$;
revoke all on function public.perform_group_administration(uuid,uuid,uuid,integer,text,uuid,integer,boolean) from public,authenticated;

create function public.rotate_group_invite(p_expected_user_id uuid,p_operation_id uuid,p_group_id uuid,p_expected_revision integer,p_expires_in_hours integer) returns jsonb
language sql security definer set search_path = '' as $$
  select public.perform_group_administration(p_expected_user_id,p_operation_id,p_group_id,p_expected_revision,'rotate',null,p_expires_in_hours,false);
$$;
create function public.transfer_group_ownership(p_expected_user_id uuid,p_operation_id uuid,p_group_id uuid,p_expected_revision integer,p_target_user_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select public.perform_group_administration(p_expected_user_id,p_operation_id,p_group_id,p_expected_revision,'transfer',p_target_user_id,null,false);
$$;
create function public.remove_group_access(p_expected_user_id uuid,p_operation_id uuid,p_group_id uuid,p_expected_revision integer,p_target_user_id uuid,p_acknowledge_ledger boolean) returns jsonb
language sql security definer set search_path = '' as $$
  select public.perform_group_administration(p_expected_user_id,p_operation_id,p_group_id,p_expected_revision,'remove',p_target_user_id,null,p_acknowledge_ledger);
$$;
create function public.leave_shared_group(p_expected_user_id uuid,p_operation_id uuid,p_group_id uuid,p_expected_revision integer,p_acknowledge_ledger boolean) returns jsonb
language sql security definer set search_path = '' as $$
  select public.perform_group_administration(p_expected_user_id,p_operation_id,p_group_id,p_expected_revision,'leave',null,null,p_acknowledge_ledger);
$$;
revoke all on function public.rotate_group_invite(uuid,uuid,uuid,integer,integer) from public;
revoke all on function public.transfer_group_ownership(uuid,uuid,uuid,integer,uuid) from public;
revoke all on function public.remove_group_access(uuid,uuid,uuid,integer,uuid,boolean) from public;
revoke all on function public.leave_shared_group(uuid,uuid,uuid,integer,boolean) from public;
grant execute on function public.rotate_group_invite(uuid,uuid,uuid,integer,integer) to authenticated;
grant execute on function public.transfer_group_ownership(uuid,uuid,uuid,integer,uuid) to authenticated;
grant execute on function public.remove_group_access(uuid,uuid,uuid,integer,uuid,boolean) to authenticated;
grant execute on function public.leave_shared_group(uuid,uuid,uuid,integer,boolean) to authenticated;

create or replace function public.join_group_by_invite(p_invite_code text,p_expected_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare g public.groups%rowtype; inserted integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  select * into g from public.groups where invite_code=p_invite_code and archived_at is null and invite_expires_at>now() for update;
  if not found then raise exception 'This invitation is expired, rotated, invalid, or the group is archived.'; end if;
  insert into public.group_access(group_id,user_id,role) values(g.id,auth.uid(),'member') on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted>0 then
    update public.groups set revision=revision+1 where id=g.id;
    insert into public.group_activity(id,group_id,actor_id,action,text,details,created_at)
      values(gen_random_uuid(),g.id,auth.uid(),'access_join','',jsonb_build_object('participantClaimed',false)::text,now());
  end if;
  return g.id;
end;
$$;
