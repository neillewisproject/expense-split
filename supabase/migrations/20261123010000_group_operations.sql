-- Apply manually after review. No legacy author attribution is inferred.
create function public.is_supported_group_currency(p_currency text) returns boolean
language sql immutable set search_path = '' as $$
  select p_currency = any(string_to_array(
    'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWG',
    ' '));
$$;
revoke all on function public.is_supported_group_currency(text) from public,authenticated;
alter table public.groups add column currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$');
alter table public.groups add constraint supported_group_currency check (public.is_supported_group_currency(currency));
alter table public.groups add column revision integer not null default 0 check (revision >= 0);
alter table public.groups add column archived_at timestamptz;
alter table public.group_members add column deactivated_at timestamptz;
alter table public.group_members add column user_id uuid references auth.users(id) on delete set null;
create unique index group_member_identity_idx on public.group_members(group_id,user_id) where user_id is not null;
alter table public.group_expenses add column currency text not null default 'INR';
alter table public.group_expenses add column contributions jsonb;
alter table public.group_expenses add column split_inputs jsonb;
alter table public.group_expenses add column itemized jsonb;
alter table public.group_expenses add column conversion jsonb;
alter table public.group_expenses add column category text not null default 'other';
alter table public.group_expenses add column notes text not null default '';
alter table public.group_expenses add column method text not null default '';
alter table public.group_expenses add column reference text not null default '';
alter table public.group_expenses add column author_id uuid references auth.users(id) on delete set null;
alter table public.group_expenses add column updated_at timestamptz;
alter table public.group_expenses add column revision integer not null default 0;
alter table public.group_expenses add column deleted_at timestamptz;
update public.group_expenses set contributions = jsonb_build_object(paid_by_member_id::text, amount), updated_at = created_at;
alter table public.group_expenses alter column contributions set not null;
alter table public.group_expenses alter column updated_at set not null;

create table public.group_activity (
  id uuid primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  expense_id uuid references public.group_expenses(id),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  text text not null default '' check (char_length(text) <= 1000),
  details text not null default '',
  created_at timestamptz not null
);
create index group_activity_group_idx on public.group_activity(group_id);
create table public.group_operation_receipts (
  id uuid primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  snapshot_hash text not null,
  revision integer not null,
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.group_activity enable row level security;
alter table public.group_operation_receipts enable row level security;
grant select on public.group_activity, public.group_operation_receipts to authenticated;
create policy "Members read activity" on public.group_activity for select to authenticated using (public.is_group_member(group_id));
create policy "Members read immutable operation history" on public.group_operation_receipts for select to authenticated using (public.is_group_member(group_id));

-- Direct table writes are closed: even owner writes must use the atomic revision protocol.
revoke insert, update, delete on public.groups, public.group_members, public.group_expenses, public.expense_splits, public.group_activity, public.group_operation_receipts from authenticated;
drop policy "Group owners can update their groups" on public.groups;
drop policy "Group owners can delete their groups" on public.groups;
drop policy "Group members can manage participants" on public.group_members;
drop policy "Group members can manage expenses" on public.group_expenses;
drop policy "Group members can manage expense splits" on public.expense_splits;
create policy "Members read participants" on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy "Members read expenses" on public.group_expenses for select to authenticated using (public.is_group_member(group_id));
create policy "Members read allocations" on public.expense_splits for select to authenticated using (
  exists(select 1 from public.group_expenses e where e.id = expense_id and public.is_group_member(e.group_id))
);
-- Defense-in-depth policies; DML grants remain revoked, so these do not bypass the RPC.
create policy "Owners correct expenses" on public.group_expenses for update to authenticated
using (public.is_group_member(group_id) and exists(select 1 from public.groups g where g.id=group_id and g.created_by=auth.uid()))
with check (public.is_group_member(group_id) and exists(select 1 from public.groups g where g.id=group_id and g.created_by=auth.uid()));
create policy "Authors correct their verified entries" on public.group_expenses for update to authenticated
using (public.is_group_member(group_id) and author_id=auth.uid())
with check (public.is_group_member(group_id) and author_id=auth.uid());
create policy "Owners manage participants" on public.group_members for update to authenticated
using (public.is_group_member(group_id) and exists(select 1 from public.groups g where g.id=group_id and g.created_by=auth.uid()))
with check (public.is_group_member(group_id) and exists(select 1 from public.groups g where g.id=group_id and g.created_by=auth.uid()));
revoke execute on function public.create_shared_group(uuid,text,timestamptz,jsonb) from authenticated;

create function public.group_ledger_snapshot(p_group_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id',g.id,'name',g.name,'currency',g.currency,'ownerId',g.created_by,
    'revision',g.revision,'archivedAt',case when g.archived_at is null then null else to_char(g.archived_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'createdAt',to_char(g.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'inviteCode',g.invite_code,
    'members',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'groupId',m.group_id,'name',m.name,'createdAt',to_char(m.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'deactivatedAt',case when m.deactivated_at is null then null else to_char(m.deactivated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,'userId',m.user_id
    ) order by m.created_at,m.id) from public.group_members m where m.group_id=g.id),'[]'::jsonb),
    'expenses',coalesce((select jsonb_agg(jsonb_build_object(
      'id',e.id,'description',e.description,'amount',e.amount,'paidBy',e.paid_by_member_id,
      'split',coalesce((select jsonb_object_agg(s.member_id::text,s.amount) from public.expense_splits s where s.expense_id=e.id),'{}'::jsonb),
      'createdAt',to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'date',e.date,'kind',e.kind,'currency',e.currency,
      'contributions',e.contributions,'splitInputs',e.split_inputs,'itemized',e.itemized,'conversion',e.conversion,'category',e.category,'notes',e.notes,'method',e.method,'reference',e.reference,
      'authorId',e.author_id,'updatedAt',to_char(e.updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'revision',e.revision,
      'deletedAt',case when e.deleted_at is null then null else to_char(e.deleted_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end
    ) order by e.date desc,e.created_at desc,e.id) from public.group_expenses e where e.group_id=g.id),'[]'::jsonb),
    'activity',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'groupId',a.group_id,'expenseId',a.expense_id,'actorId',a.actor_id,'action',a.action,'text',a.text,'details',a.details,
      'createdAt',to_char(a.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    ) order by a.created_at desc,a.id) from public.group_activity a where a.group_id=g.id),'[]'::jsonb)
  ) from public.groups g where g.id=p_group_id;
$$;
revoke all on function public.group_ledger_snapshot(uuid) from public, authenticated;

create function public.get_shared_group_snapshots(p_expected_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  return (select coalesce(jsonb_agg(public.group_ledger_snapshot(a.group_id)),'[]'::jsonb)
  from public.group_access a where a.user_id=(select auth.uid()));
end;
$$;
revoke all on function public.get_shared_group_snapshots(uuid) from public;
grant execute on function public.get_shared_group_snapshots(uuid) to authenticated;

-- Server-side saved-input validation prevents malformed edits from poisoning later downloads.
create function public.calculate_group_allocation(p_total bigint,p_inputs jsonb,p_bill jsonb default null)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  mode text := p_inputs->>'mode';
  selected jsonb := p_inputs->'memberIds';
  weights jsonb := p_inputs->'values';
  result jsonb := '{}'::jsonb;
  part record;
  item jsonb;
  item_split jsonb;
  consumed jsonb := '{}'::jsonb;
  discount_split jsonb;
  extra_split jsonb;
  subtotal bigint := 0;
  discount bigint;
  charges bigint;
  residual bigint;
  adjustment_total bigint;
  weight_total numeric;
  base_total bigint;
begin
  if p_total<0 or p_total>2147483647 then raise exception 'Invalid allocation total.'; end if;
  if mode is null or mode not in ('equally','exact','percentages','shares','adjustments','itemized') then raise exception 'Unsupported split mode.'; end if;
  if jsonb_typeof(selected) is distinct from 'array' or jsonb_array_length(selected)=0 or
    (select count(*) from jsonb_array_elements_text(selected))<>(select count(distinct value) from jsonb_array_elements_text(selected)) then raise exception 'Select unique participants.'; end if;
  if jsonb_typeof(weights) is distinct from 'object' or exists(select 1 from jsonb_object_keys(weights) x where not selected ? x) then raise exception 'Invalid selected allocation inputs.'; end if;
  if exists(select 1 from jsonb_each(weights) where jsonb_typeof(value)<>'number') then raise exception 'Split inputs must be numbers.'; end if;
  if mode='equally' then
    select jsonb_object_agg(value,to_jsonb(p_total/jsonb_array_length(selected)+case when ordinal<=mod(p_total,jsonb_array_length(selected)) then 1 else 0 end))
    into result from jsonb_array_elements_text(selected) with ordinality x(value,ordinal);
    return result;
  elsif mode='adjustments' then
    if exists(select 1 from jsonb_each_text(weights) where value !~ '^-?[0-9]+$') then raise exception 'Adjustments must be integer minor units.'; end if;
    select coalesce(sum(value::bigint),0) into adjustment_total from jsonb_each_text(weights);
    residual:=p_total-adjustment_total;
    if residual<0 or residual>2147483647 then raise exception 'Adjustments exceed available total.'; end if;
    result:=public.calculate_group_allocation(residual,jsonb_build_object('mode','equally','memberIds',selected,'values','{}'::jsonb));
    for part in select key,value from jsonb_each_text(result) loop
      base_total:=part.value::bigint+coalesce((weights->>part.key)::bigint,0);
      if base_total<0 then raise exception 'Adjusted shares cannot be negative.'; end if;
      result:=jsonb_set(result,array[part.key],to_jsonb(base_total));
    end loop;
    return result;
  elsif mode='exact' then
    if exists(select 1 from jsonb_each_text(weights) where value !~ '^[0-9]+$') or
      (select coalesce(sum(value::bigint),0) from jsonb_each_text(weights))<>p_total then raise exception 'Exact shares must sum to the total.'; end if;
    return weights;
  elsif mode='itemized' then
    if p_bill is null or jsonb_typeof(p_bill->'items') is distinct from 'array' or jsonb_array_length(p_bill->'items')=0 then raise exception 'Add bill items.'; end if;
    if (select count(*) from jsonb_array_elements(p_bill->'items'))<>(select count(distinct value->>'id') from jsonb_array_elements(p_bill->'items')) then raise exception 'Item IDs must be unique.'; end if;
    for item in select value from jsonb_array_elements(p_bill->'items') loop
      if jsonb_typeof(item->'quantity') is distinct from 'number' or jsonb_typeof(item->'unitAmount') is distinct from 'number' or
        jsonb_typeof(item->'description') is distinct from 'string' or item->>'quantity' !~ '^[0-9]+$' or (item->>'quantity')::bigint<=0 or
        item->>'unitAmount' !~ '^[0-9]+$' or btrim(item->>'description')='' then raise exception 'Invalid bill item price, quantity or description.'; end if;
      base_total:=(item->>'quantity')::bigint*(item->>'unitAmount')::bigint;
      subtotal:=subtotal+base_total;
      item_split:=public.calculate_group_allocation(base_total,jsonb_build_object('mode','shares','memberIds',selected,'values',item->'shares'));
      for part in select key,value from jsonb_each_text(item_split) loop
        consumed:=jsonb_set(consumed,array[part.key],to_jsonb(coalesce((consumed->>part.key)::bigint,0)+part.value::bigint));
      end loop;
    end loop;
    if exists(select 1 from jsonb_each(p_bill->'adjustments') where jsonb_typeof(value)<>'number') or
      exists(select 1 from jsonb_each_text(p_bill->'adjustments') where value !~ '^[0-9]+$') then raise exception 'Bill adjustments must be nonnegative minor units.'; end if;
    discount:=(p_bill->'adjustments'->>'discount')::bigint;
    charges:=(p_bill->'adjustments'->>'tax')::bigint+(p_bill->'adjustments'->>'tip')::bigint;
    if discount is null or charges is null or subtotal<=0 or discount>subtotal or subtotal-discount+charges<>p_total then raise exception 'Itemized total does not match the expense.'; end if;
    discount_split:=public.calculate_group_allocation(discount,jsonb_build_object('mode','shares','memberIds',selected,'values',consumed));
    extra_split:=public.calculate_group_allocation(charges,jsonb_build_object('mode','shares','memberIds',selected,'values',consumed));
    for part in select value from jsonb_array_elements_text(selected) loop
      result:=jsonb_set(result,array[part.value],to_jsonb(coalesce((consumed->>part.value)::bigint,0)-
        coalesce((discount_split->>part.value)::bigint,0)+coalesce((extra_split->>part.value)::bigint,0)));
    end loop;
    return result;
  elsif mode not in ('shares','percentages') then raise exception 'Unsupported split mode.'; end if;
  if exists(select 1 from jsonb_each_text(weights) where value::numeric<0) then raise exception 'Weights cannot be negative.'; end if;
  select coalesce(sum(value::numeric),0) into weight_total from jsonb_each_text(weights);
  if weight_total<=0 or weight_total>1.7976931348623157e308::numeric then raise exception 'At least one participant needs a finite positive weight.'; end if;
  if mode='percentages' and (weight_total<>100 or exists(select 1 from jsonb_each_text(weights) where value::numeric>100 or value::numeric*100<>trunc(value::numeric*100))) then raise exception 'Percentages must sum to 100 with at most two decimal places.'; end if;
  select coalesce(sum(floor(p_total*value::numeric/weight_total)),0)::bigint into base_total from jsonb_each_text(weights) where value::numeric>0;
  residual:=p_total-base_total;
  for part in
    select w.key,floor(p_total*w.value::numeric/weight_total)::bigint amount,
      row_number() over(order by mod(p_total*w.value::numeric,weight_total) desc,x.ordinal) remainder_rank
    from jsonb_each_text(weights) w join jsonb_array_elements_text(selected) with ordinality x(value,ordinal) on w.key=x.value
    where w.value::numeric>0
  loop
    result:=jsonb_set(result,array[part.key],to_jsonb(part.amount+case when part.remainder_rank<=residual then 1 else 0 end));
  end loop;
  return result;
end;
$$;
revoke all on function public.calculate_group_allocation(bigint,jsonb,jsonb) from public,authenticated;

create function public.assert_group_allocation(p_total bigint,p_inputs jsonb,p_bill jsonb,p_actual jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare expected jsonb;
begin
  expected:=public.calculate_group_allocation(p_total,p_inputs,p_bill);
  if exists(select 1 from (
    select key from jsonb_object_keys(expected) x(key) union select key from jsonb_object_keys(p_actual) x(key)
  ) ids where coalesce((expected->>ids.key)::numeric,0)<>coalesce((p_actual->>ids.key)::numeric,0)) then
    raise exception 'Saved inputs do not match canonical allocations.';
  end if;
end;
$$;
revoke all on function public.assert_group_allocation(bigint,jsonb,jsonb,jsonb) from public,authenticated;

create function public.apply_group_operation(
  p_expected_user_id uuid,p_operation_id uuid,p_group_id uuid,p_base_revision integer,p_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  target public.groups%rowtype;
  receipt public.group_operation_receipts%rowtype;
  before_data jsonb;
  old_entry jsonb;
  entry jsonb;
  part record;
  paid_total bigint;
  owed_total bigint;
  is_owner boolean;
  entry_id uuid;
  member_id uuid;
  next_revision integer;
  allocation jsonb;
  original_data jsonb;
  bill_data jsonb;
  split_data jsonb;
  expected_base numeric;
  original_total bigint;
begin
  if actor is null or actor is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_group_id::text,0));
  select * into receipt from public.group_operation_receipts where id=p_operation_id;
  if found then
    if receipt.actor_id<>actor or receipt.group_id<>p_group_id or receipt.snapshot_hash<>md5(p_snapshot::text) then
      raise exception 'Operation ID cannot be reused with different content.';
    end if;
    if not public.is_group_member(p_group_id) then raise exception 'Shared group access is unavailable.'; end if;
    return jsonb_build_object('revision',receipt.revision,'inviteCode',(select invite_code from public.groups where id=p_group_id));
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or (p_snapshot->>'id')::uuid is distinct from p_group_id or
    jsonb_typeof(p_snapshot->'members') is distinct from 'array' or
    jsonb_typeof(p_snapshot->'expenses') is distinct from 'array' or
    jsonb_typeof(p_snapshot->'activity') is distinct from 'array' then raise exception 'Invalid full group snapshot.'; end if;
  select * into target from public.groups where id=p_group_id for update;
  if not found then
    if p_base_revision<>0 or (p_snapshot->>'ownerId')::uuid is distinct from actor or jsonb_array_length(p_snapshot->'members')<2 then
      raise exception 'New shared groups require an authenticated owner and at least two participants.';
    end if;
    insert into public.groups(id,name,created_by,created_at,currency)
    values(p_group_id,btrim(p_snapshot->>'name'),actor,(p_snapshot->>'createdAt')::timestamptz,p_snapshot->>'currency') returning * into target;
    insert into public.group_access(group_id,user_id,role) values(p_group_id,actor,'owner');
  else
    if not public.is_group_member(p_group_id) then raise exception 'Shared group access is unavailable.'; end if;
    if target.revision<>p_base_revision then raise exception 'REVISION_CONFLICT: refresh and resolve this group.'; end if;
    before_data := public.group_ledger_snapshot(p_group_id);
  end if;
  is_owner := target.created_by=actor;
  if (p_snapshot->>'ownerId')::uuid is distinct from target.created_by or
    (p_snapshot->>'createdAt')::timestamptz is distinct from date_trunc('milliseconds',target.created_at) or
    p_snapshot->>'currency' is distinct from target.currency then raise exception 'Owner, creation date and base currency cannot change.'; end if;
  if not is_owner and (
    p_snapshot->>'name' is distinct from target.name or
    (p_snapshot->>'archivedAt')::timestamptz is distinct from target.archived_at
  ) then raise exception 'Only the owner can manage this group.'; end if;

  -- Never remove referenced participants or financial entries: use deactivation/tombstones.
  if exists(select 1 from public.group_members m where m.group_id=p_group_id and not exists(
    select 1 from jsonb_array_elements(p_snapshot->'members') x where (x->>'id')::uuid=m.id
  )) or exists(select 1 from public.group_expenses e where e.group_id=p_group_id and not exists(
    select 1 from jsonb_array_elements(p_snapshot->'expenses') x where (x->>'id')::uuid=e.id
  )) then raise exception 'Participants and entries must be retained in accounting history.'; end if;
  if (select count(*) from jsonb_array_elements(p_snapshot->'members')) <>
    (select count(distinct x->>'id') from jsonb_array_elements(p_snapshot->'members') x) or
    (select count(*) from jsonb_array_elements(p_snapshot->'expenses')) <>
    (select count(distinct x->>'id') from jsonb_array_elements(p_snapshot->'expenses') x) then raise exception 'Duplicate ledger IDs.'; end if;

  for entry in select value from jsonb_array_elements(p_snapshot->'members') loop
    member_id := (entry->>'id')::uuid;
    if (entry->>'groupId')::uuid is distinct from p_group_id then raise exception 'Participant belongs to a different group.'; end if;
    if exists(select 1 from public.group_members where id=member_id and group_id<>p_group_id) then raise exception 'Participant ID belongs to a different group.'; end if;
    select value into old_entry from jsonb_array_elements(coalesce(before_data->'members','[]'::jsonb)) where (value->>'id')::uuid=member_id;
    if not is_owner and old_entry is distinct from entry then raise exception 'Only the owner can manage participants or identities.'; end if;
    if old_entry is not null and (entry->>'createdAt')::timestamptz is distinct from (old_entry->>'createdAt')::timestamptz then raise exception 'Participant creation date cannot change.'; end if;
    if entry->>'userId' is not null and not exists(select 1 from public.group_access where group_id=p_group_id and user_id=(entry->>'userId')::uuid) then raise exception 'Identity claims require an account with group access.'; end if;
    insert into public.group_members(id,group_id,name,created_at,deactivated_at,user_id)
    values(member_id,p_group_id,btrim(entry->>'name'),(entry->>'createdAt')::timestamptz,(entry->>'deactivatedAt')::timestamptz,(entry->>'userId')::uuid)
    on conflict(id) do update set name=excluded.name,deactivated_at=excluded.deactivated_at,user_id=excluded.user_id;
  end loop;
  if (select count(*) from public.group_members where group_id=p_group_id) < 2 or
    exists(select 1 from public.group_members where group_id=p_group_id group by lower(name) having count(*)>1) then raise exception 'Use at least two uniquely named participants.'; end if;

  for entry in select value from jsonb_array_elements(p_snapshot->'expenses') loop
    if entry ? 'receipts' then raise exception 'Local receipt paths must never be uploaded.'; end if;
    entry_id := (entry->>'id')::uuid;
    if exists(select 1 from public.group_expenses where id=entry_id and group_id<>p_group_id) then raise exception 'Entry ID belongs to a different group.'; end if;
    select value into old_entry from jsonb_array_elements(coalesce(before_data->'expenses','[]'::jsonb)) where (value->>'id')::uuid=entry_id;
    if old_entry is not null then
      if (entry->>'authorId')::uuid is distinct from (old_entry->>'authorId')::uuid or
        (entry->>'createdAt')::timestamptz is distinct from (old_entry->>'createdAt')::timestamptz then raise exception 'Entry author and creation date cannot change.'; end if;
      if old_entry is distinct from entry then
        if not is_owner and (old_entry->>'authorId')::uuid is distinct from actor then raise exception 'Only the author or owner can edit an entry. Legacy entries are owner-managed.'; end if;
        if (entry->>'revision')::integer<>(old_entry->>'revision')::integer+1 then raise exception 'Invalid entry revision.'; end if;
      end if;
    else
      if (entry->>'authorId')::uuid is distinct from actor or (entry->>'revision')::integer<>1 then raise exception 'New entries must be authored by the signed-in actor.'; end if;
    end if;
    if target.archived_at is not null and old_entry is distinct from entry then raise exception 'Reopen this group before editing entries.'; end if;
    if entry->>'currency' is distinct from target.currency or entry->>'kind' not in ('expense','settlement') then raise exception 'Unsupported group currency or entry kind.'; end if;
    if jsonb_typeof(entry->'contributions') is distinct from 'object' or jsonb_typeof(entry->'split') is distinct from 'object' then raise exception 'Missing payer contributions or allocations.'; end if;
    if exists(select 1 from jsonb_each(entry->'contributions') where jsonb_typeof(value)<>'number') or
      exists(select 1 from jsonb_each(entry->'split') where jsonb_typeof(value)<>'number') then raise exception 'Contributions and allocations must be numeric minor units.'; end if;
    if not exists(select 1 from public.group_members where id=(entry->>'paidBy')::uuid and group_id=p_group_id) then raise exception 'Payer must belong to this group.'; end if;
    if coalesce((entry->'contributions'->>(entry->>'paidBy'))::bigint,0)<=0 then raise exception 'The selected payer must contribute to the expense.'; end if;
    paid_total:=0; owed_total:=0;
    for part in select key,value from jsonb_each_text(entry->'contributions') loop
      if part.value !~ '^[0-9]+$' or not exists(select 1 from public.group_members where id=part.key::uuid and group_id=p_group_id) then raise exception 'Invalid contribution participant or amount.'; end if;
      paid_total:=paid_total+part.value::bigint;
    end loop;
    for part in select key,value from jsonb_each_text(entry->'split') loop
      if part.value !~ '^[0-9]+$' or not exists(select 1 from public.group_members where id=part.key::uuid and group_id=p_group_id) then raise exception 'Invalid allocation participant or amount.'; end if;
      owed_total:=owed_total+part.value::bigint;
    end loop;
    if paid_total<>(entry->>'amount')::bigint or owed_total<>paid_total or paid_total<=0 then raise exception 'Contributions and allocations must each sum to the total.'; end if;
    if entry->>'kind'='settlement' and (
      (select count(*) from jsonb_each_text(entry->'contributions') where value::bigint>0)<>1 or
      (select count(*) from jsonb_each_text(entry->'split') where value::bigint>0)<>1 or
      exists(select 1 from jsonb_each_text(entry->'contributions') p join jsonb_each_text(entry->'split') s on p.key=s.key where p.value::bigint>0 and s.value::bigint>0)
    ) then raise exception 'Settlement sender and recipient must differ.'; end if;
    if entry->'splitInputs' is not null and entry->'splitInputs'<>'null'::jsonb then
      if jsonb_typeof(entry->'splitInputs'->'memberIds') is distinct from 'array' or
        jsonb_typeof(entry->'splitInputs'->'values') is distinct from 'object' then raise exception 'Invalid saved split inputs.'; end if;
      if exists(select 1 from jsonb_array_elements_text(entry->'splitInputs'->'memberIds') x where not exists(
        select 1 from public.group_members m where m.id=x.value::uuid and m.group_id=p_group_id
      )) or exists(select 1 from jsonb_object_keys(entry->'splitInputs'->'values') x where not (entry->'splitInputs'->'memberIds') ? x) then raise exception 'Saved split inputs reference another group.'; end if;
    end if;
    original_data := nullif(entry->'conversion','null'::jsonb);
    if original_data is not null then
      if jsonb_typeof(original_data)<>'object' or jsonb_typeof(original_data->'originalAmount') is distinct from 'number' or
        jsonb_typeof(original_data->'originalCurrency') is distinct from 'string' or
        jsonb_typeof(original_data->'rate') is distinct from 'string' or
        jsonb_typeof(original_data->'originalExponent') is distinct from 'number' or
        jsonb_typeof(original_data->'baseExponent') is distinct from 'number' or
        original_data->>'originalAmount' !~ '^[0-9]+$' or original_data->>'originalExponent' !~ '^[0-3]$' or
        original_data->>'baseExponent' !~ '^[0-3]$' or not public.is_supported_group_currency(original_data->>'originalCurrency') or
        original_data->>'rate' !~ '^[0-9]+(\.[0-9]{1,18})?$' or char_length(original_data->>'rate')>40 or
        (original_data->>'rate')::numeric<=0 or
        (original_data->>'originalExponent')::integer not between 0 and 3 or
        (original_data->>'baseExponent')::integer not between 0 and 3 then raise exception 'Invalid fixed-rate conversion metadata.'; end if;
      original_total := (original_data->>'originalAmount')::bigint;
      if original_total<=0 or original_total>2147483647 then raise exception 'Invalid original amount.'; end if;
      foreach allocation in array array[original_data->'originalSplit',original_data->'originalContributions'] loop
        if jsonb_typeof(allocation) is distinct from 'object' then raise exception 'Invalid original allocations.'; end if;
        if exists(select 1 from jsonb_each(allocation) where jsonb_typeof(value)<>'number') then raise exception 'Original allocations must be numeric minor units.'; end if;
        owed_total := 0;
        for part in select key,value from jsonb_each_text(allocation) loop
          if part.value !~ '^[0-9]+$' or not exists(select 1 from public.group_members where id=part.key::uuid and group_id=p_group_id) then raise exception 'Original allocations reference another group or invalid amount.'; end if;
          owed_total:=owed_total+part.value::bigint;
        end loop;
        if owed_total<>original_total then raise exception 'Original allocations must sum to their original total.'; end if;
      end loop;
      expected_base := round(original_total*(original_data->>'rate')::numeric *
        power(10::numeric,(original_data->>'baseExponent')::integer-(original_data->>'originalExponent')::integer));
      if expected_base<>(entry->>'amount')::numeric then raise exception 'Base total does not match the saved fixed rate.'; end if;
      perform public.assert_group_allocation((entry->>'amount')::bigint,
        jsonb_build_object('mode','shares','memberIds',(select jsonb_agg(key order by key) from jsonb_each(original_data->'originalSplit')),'values',original_data->'originalSplit'),
        null,entry->'split');
      perform public.assert_group_allocation((entry->>'amount')::bigint,
        jsonb_build_object('mode','shares','memberIds',(select jsonb_agg(key order by key) from jsonb_each(original_data->'originalContributions')),'values',original_data->'originalContributions'),
        null,entry->'contributions');
    end if;
    -- Validate saved original and base itemization references as well as canonical allocations.
    foreach split_data in array array[nullif(entry->'splitInputs','null'::jsonb),nullif(original_data->'splitInputs','null'::jsonb)] loop
      if split_data is not null then
        if jsonb_typeof(split_data->'memberIds') is distinct from 'array' or jsonb_typeof(split_data->'values') is distinct from 'object' or
          split_data->>'mode' not in ('equally','exact','percentages','shares','adjustments','itemized') then raise exception 'Invalid saved split input mode.'; end if;
        if jsonb_array_length(split_data->'memberIds')=0 or exists(select 1 from jsonb_array_elements_text(split_data->'memberIds') x where not exists(
          select 1 from public.group_members m where m.id=x.value::uuid and m.group_id=p_group_id
        )) or exists(select 1 from jsonb_object_keys(split_data->'values') x where not (split_data->'memberIds') ? x) then raise exception 'Original split inputs reference another group.'; end if;
      end if;
    end loop;
    if nullif(entry->'splitInputs','null'::jsonb) is not null then
      perform public.assert_group_allocation((entry->>'amount')::bigint,entry->'splitInputs',nullif(entry->'itemized','null'::jsonb),entry->'split');
    end if;
    if nullif(original_data->'splitInputs','null'::jsonb) is not null then
      perform public.assert_group_allocation(original_total,original_data->'splitInputs',nullif(original_data->'itemized','null'::jsonb),original_data->'originalSplit');
    end if;
    foreach bill_data in array array[nullif(entry->'itemized','null'::jsonb),nullif(original_data->'itemized','null'::jsonb)] loop
      if bill_data is not null then
        if jsonb_typeof(bill_data->'items') is distinct from 'array' or jsonb_typeof(bill_data->'adjustments') is distinct from 'object' then raise exception 'Invalid saved itemized bill.'; end if;
        for allocation in select value from jsonb_array_elements(bill_data->'items') loop
          if jsonb_typeof(allocation->'shares') is distinct from 'object' or (allocation->>'quantity')::integer<=0 or (allocation->>'unitAmount')::bigint<0 then raise exception 'Invalid saved bill item.'; end if;
          for part in select key,value from jsonb_each_text(allocation->'shares') loop
            if part.value::numeric<0 or not exists(select 1 from public.group_members where id=part.key::uuid and group_id=p_group_id) then raise exception 'Itemized bill references another group.'; end if;
          end loop;
        end loop;
      end if;
    end loop;
    insert into public.group_expenses(id,group_id,description,amount,paid_by_member_id,date,kind,created_at,currency,contributions,split_inputs,itemized,conversion,category,notes,method,reference,author_id,updated_at,revision,deleted_at)
    values(entry_id,p_group_id,btrim(entry->>'description'),(entry->>'amount')::integer,(entry->>'paidBy')::uuid,(entry->>'date')::date,entry->>'kind',(entry->>'createdAt')::timestamptz,entry->>'currency',entry->'contributions',nullif(entry->'splitInputs','null'::jsonb),nullif(entry->'itemized','null'::jsonb),nullif(entry->'conversion','null'::jsonb),entry->>'category',entry->>'notes',entry->>'method',entry->>'reference',(entry->>'authorId')::uuid,(entry->>'updatedAt')::timestamptz,(entry->>'revision')::integer,(entry->>'deletedAt')::timestamptz)
    on conflict(id) do update set description=excluded.description,amount=excluded.amount,paid_by_member_id=excluded.paid_by_member_id,date=excluded.date,kind=excluded.kind,contributions=excluded.contributions,split_inputs=excluded.split_inputs,itemized=excluded.itemized,conversion=excluded.conversion,category=excluded.category,notes=excluded.notes,method=excluded.method,reference=excluded.reference,updated_at=excluded.updated_at,revision=excluded.revision,deleted_at=excluded.deleted_at;
    delete from public.expense_splits where expense_id=entry_id;
    insert into public.expense_splits(expense_id,member_id,amount)
    select entry_id,key::uuid,value::integer from jsonb_each_text(entry->'split');
  end loop;
  for entry in select value from jsonb_array_elements(p_snapshot->'activity') loop
    if (entry->>'groupId')::uuid is distinct from p_group_id then raise exception 'Activity belongs to another group.'; end if;
    if exists(select 1 from public.group_activity where id=(entry->>'id')::uuid and group_id<>p_group_id) then raise exception 'Activity ID belongs to another group.'; end if;
    select value into old_entry from jsonb_array_elements(coalesce(before_data->'activity','[]'::jsonb)) where value->>'id'=entry->>'id';
    if old_entry is not null and old_entry is distinct from entry then raise exception 'Activity history cannot be edited.'; end if;
    if old_entry is null then
      if (entry->>'actorId')::uuid is distinct from actor then raise exception 'Activity actor must match signed-in user.'; end if;
      if entry->>'expenseId' is not null and not exists(select 1 from public.group_expenses where id=(entry->>'expenseId')::uuid and group_id=p_group_id) then raise exception 'Comment entry belongs to another group.'; end if;
      insert into public.group_activity(id,group_id,expense_id,actor_id,action,text,details,created_at)
      values((entry->>'id')::uuid,p_group_id,(entry->>'expenseId')::uuid,actor,entry->>'action',entry->>'text',coalesce(entry->>'details',''),(entry->>'createdAt')::timestamptz);
    end if;
  end loop;
  next_revision := target.revision+1;
  update public.groups set name=btrim(p_snapshot->>'name'),archived_at=(p_snapshot->>'archivedAt')::timestamptz,revision=next_revision where id=p_group_id;
  insert into public.group_operation_receipts(id,group_id,actor_id,snapshot_hash,revision,before_snapshot,after_snapshot)
  values(p_operation_id,p_group_id,actor,md5(p_snapshot::text),next_revision,before_data,public.group_ledger_snapshot(p_group_id));
  return jsonb_build_object('revision',next_revision,'inviteCode',target.invite_code);
end;
$$;
revoke all on function public.apply_group_operation(uuid,uuid,uuid,integer,jsonb) from public;
grant execute on function public.apply_group_operation(uuid,uuid,uuid,integer,jsonb) to authenticated;
revoke execute on function public.join_group_by_invite(text) from authenticated;
create function public.join_group_by_invite(p_invite_code text,p_expected_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target_group_id uuid;
begin
  if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise exception 'The signed-in account changed.'; end if;
  select id into target_group_id from public.groups where invite_code=p_invite_code and archived_at is null;
  if target_group_id is null then raise exception 'This invitation is invalid or the group is archived.'; end if;
  insert into public.group_access(group_id,user_id,role) values(target_group_id,auth.uid(),'member') on conflict do nothing;
  return target_group_id;
end;
$$;
revoke all on function public.join_group_by_invite(text,uuid) from public;
grant execute on function public.join_group_by_invite(text,uuid) to authenticated;
alter publication supabase_realtime add table public.group_activity;
