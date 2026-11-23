-- Requires the group operations migration and its author/deletion metadata.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-receipts', 'group-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members read private group receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'group-receipts'
    and exists (
      select 1 from public.group_expenses expense
      where expense.group_id::text = (storage.foldername(storage.objects.name))[1]
        and expense.id::text = (storage.foldername(storage.objects.name))[2]
        and expense.deleted_at is null
        and public.is_group_member(expense.group_id)
    )
  );

create policy "Authors upload their own receipt objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'group-receipts'
    and split_part(storage.filename(storage.objects.name), '_', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.group_expenses expense
      join public.groups ledger on ledger.id = expense.group_id
      where expense.group_id::text = (storage.foldername(storage.objects.name))[1]
        and expense.id::text = (storage.foldername(storage.objects.name))[2]
        and expense.deleted_at is null
        and public.is_group_member(expense.group_id)
        and (expense.author_id = (select auth.uid()) or ledger.created_by = (select auth.uid()))
    )
  );

create policy "Uploaders replace only their authorized receipt objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'group-receipts'
    and split_part(storage.filename(storage.objects.name), '_', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.group_expenses expense
      join public.groups ledger on ledger.id = expense.group_id
      where expense.group_id::text = (storage.foldername(storage.objects.name))[1]
        and expense.id::text = (storage.foldername(storage.objects.name))[2]
        and expense.deleted_at is null
        and public.is_group_member(expense.group_id)
        and (expense.author_id = (select auth.uid()) or ledger.created_by = (select auth.uid()))
    )
  )
  with check (
    bucket_id = 'group-receipts'
    and split_part(storage.filename(storage.objects.name), '_', 1) = (select auth.uid())::text
    and exists (
      select 1 from public.group_expenses expense
      join public.groups ledger on ledger.id = expense.group_id
      where expense.group_id::text = (storage.foldername(storage.objects.name))[1]
        and expense.id::text = (storage.foldername(storage.objects.name))[2]
        and expense.deleted_at is null
        and public.is_group_member(expense.group_id)
        and (expense.author_id = (select auth.uid()) or ledger.created_by = (select auth.uid()))
    )
  );
