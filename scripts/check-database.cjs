const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const member = '00000000-0000-4000-8000-000000000002';
const outsider = '00000000-0000-4000-8000-000000000003';
const group = '10000000-0000-4000-8000-000000000001';
const participant = '20000000-0000-4000-8000-000000000001';
const expense = '30000000-0000-4000-8000-000000000001';
let checks = 0;

async function asUser(id) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec('set role authenticated');
}
async function rejects(work, pattern) {
  await assert.rejects(work, pattern);
  checks++;
}
async function query(sql, parameters = []) {
  return (await db.query(sql, parameters)).rows;
}

(async () => {
  try {
    await db.waitReady;
    // Provider fixtures model identity and Storage metadata, not the live provider.
    await db.exec(`
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
      $$;
      grant usage on schema auth to authenticated;
      create publication supabase_realtime;
      create schema storage;
      create table storage.buckets(
        id text primary key, name text, public boolean, file_size_limit bigint,
        allowed_mime_types text[]
      );
      create table storage.objects(
        name text primary key, bucket_id text references storage.buckets(id), owner_id text
      );
      alter table storage.objects enable row level security;
      grant usage on schema storage to authenticated;
      grant select,insert,update,delete on storage.objects to authenticated;
      create function storage.foldername(p_name text) returns text[]
        language sql immutable as $$
          select (string_to_array(p_name,'/'))[1:array_length(string_to_array(p_name,'/'),1)-1];
        $$;
      create function storage.filename(p_name text) returns text
        language sql immutable as $$ select regexp_replace(p_name,'^.*/',''); $$;
      insert into auth.users values('${owner}'),('${member}'),('${outsider}');
    `);
    const directory = path.join(__dirname, '..', 'supabase', 'migrations');
    for (const filename of fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.sql'))
      .sort()) {
      await db.exec(fs.readFileSync(path.join(directory, filename), 'utf8'));
      checks++;
    }

    await asUser(owner);
    const document = {
      format: 'expense-split-personal',
      version: 2,
      expenses: [],
      goals: [],
      contributions: [],
    };
    const save = (actor, value, revision) =>
      query('select public.save_personal_backup($1::uuid,$2::jsonb,$3::integer) revision', [
        actor,
        JSON.stringify(value),
        revision,
      ]);
    assert.equal((await save(owner, document, 0))[0].revision, 1);
    checks++;
    assert.equal((await save(owner, document, 0))[0].revision, 1);
    checks++;
    await rejects(
      () => save(owner, { ...document, expenses: [{ id: 'changed' }] }, 0),
      /cloud backup changed/,
    );
    await rejects(() => save(member, document, 0), /account changed/);
    await asUser(member);
    assert.equal(
      (await query('select * from public.get_personal_backup($1::uuid)', [member])).length,
      0,
    );
    checks++;
    assert.equal((await query('select * from public.personal_backups')).length, 0);
    checks++;
    await rejects(
      () => query('select * from public.get_personal_backup($1::uuid)', [owner]),
      /account changed/,
    );
    await asUser(owner);
    await rejects(
      () => query('select public.delete_personal_backup($1::uuid,$2::integer)', [owner, 0]),
      /backup changed/,
    );
    assert.equal(
      (
        await query('select public.delete_personal_backup($1::uuid,$2::integer) removed', [
          owner,
          1,
        ])
      )[0].removed,
      true,
    );
    checks++;

    await db.exec(`reset role;
      insert into public.groups(id,name,created_by) values('${group}','Storage fixture','${owner}');
      insert into public.group_access(group_id,user_id,role) values('${group}','${owner}','owner'),('${group}','${member}','member');
      insert into public.group_members(id,group_id,name,created_at) values('${participant}','${group}','Owner',now());
      insert into public.group_expenses(id,group_id,description,amount,paid_by_member_id,date,kind,created_at,updated_at,author_id,contributions)
      values('${expense}','${group}','Receipt fixture',100,'${participant}',current_date,'expense',now(),now(),'${owner}','{"${participant}":100}');
    `);
    const object = `${group}/${expense}/${owner}_photo.jpg`;
    await asUser(owner);
    await query('insert into storage.objects(name,bucket_id,owner_id) values($1,$2,$3)', [
      object,
      'group-receipts',
      owner,
    ]);
    checks++;
    await asUser(member);
    assert.equal((await query('select * from storage.objects')).length, 1);
    checks++;
    await rejects(
      () =>
        query('insert into storage.objects(name,bucket_id,owner_id) values($1,$2,$3)', [
          `${group}/${expense}/${owner}_forged.jpg`,
          'group-receipts',
          member,
        ]),
      /row-level security/,
    );
    await rejects(
      () =>
        query('insert into storage.objects(name,bucket_id,owner_id) values($1,$2,$3)', [
          `${group}/${expense}/${member}_other-author.jpg`,
          'group-receipts',
          member,
        ]),
      /row-level security/,
    );
    await asUser(outsider);
    assert.equal((await query('select * from storage.objects')).length, 0);
    checks++;
    await asUser(owner);
    assert.equal(
      (
        await query('update storage.objects set owner_id=$1 where name=$2 returning name', [
          owner,
          object,
        ])
      )[0].name,
      object,
    );
    checks++;
    await db.exec(
      `reset role;delete from public.group_access where group_id='${group}' and user_id='${owner}';`,
    );
    await asUser(owner);
    assert.equal((await query('select * from storage.objects')).length, 0);
    checks++;
    assert.equal(
      (
        await query('update storage.objects set owner_id=$1 where name=$2 returning name', [
          owner,
          object,
        ])
      ).length,
      0,
    );
    checks++;
    console.log(
      `PASS: all migrations compiled; ${checks} private-backup/Storage PostgreSQL assertions passed in memory. Live Auth, object bytes, signed URLs and Realtime remain unverified.`,
    );
  } finally {
    await db.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
