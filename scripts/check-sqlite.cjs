const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');

const directory = path.join(__dirname, '..', 'drizzle');
const journal = JSON.parse(fs.readFileSync(path.join(directory, 'meta', '_journal.json'), 'utf8'));
const db = new DatabaseSync(':memory:');
const migrate = (entry) =>
  db.exec(fs.readFileSync(path.join(directory, `${entry.tag}.sql`), 'utf8'));
const balances = () =>
  db
    .prepare(
      `select m.id,
        coalesce((select sum(e.amount) from group_expenses e where e.paid_by_member_id=m.id),0)
        - coalesce((select sum(s.amount) from expense_splits s where s.member_id=m.id),0) balance
       from group_members m order by m.id`,
    )
    .all()
    .map((row) => ({ ...row }));

try {
  db.exec('PRAGMA foreign_keys = ON');
  journal.entries.slice(0, 4).forEach(migrate);
  db.exec(`
    insert into expenses(id,description,amount,category,date,receipt_uri,created_at,updated_at)
      values('personal','Legacy meal',12345,'food','2026-03-01','file:///legacy.jpg',
        '2026-03-01T00:00:00.000Z','2026-03-01T00:00:00.000Z');
    insert into groups(id,name,created_at) values('group','Legacy group','2026-03-01T00:00:00.000Z');
    insert into group_members(id,group_id,name,created_at) values
      ('a','group','A','2026-03-01T00:00:00.000Z'),
      ('b','group','B','2026-03-01T00:00:00.000Z');
    insert into group_expenses(id,group_id,description,amount,paid_by_member_id,date,kind,created_at)
      values('meal','group','Meal',1000,'a','2026-03-01','expense','2026-03-01T00:00:00.000Z'),
        ('payment','group','Repayment',200,'b','2026-03-01','settlement','2026-03-01T00:00:00.000Z');
    insert into expense_splits(expense_id,member_id,amount)
      values('meal','a',500),('meal','b',500),('payment','a',200);
  `);
  const before = balances();
  assert.deepEqual(before, [
    { id: 'a', balance: 300 },
    { id: 'b', balance: -300 },
  ]);
  journal.entries.slice(4, 6).forEach(migrate);
  db.exec(`
    insert into personal_recurring_rules
      (id,name,template,start_date,frequency,interval,next_date,active)
      values('old-rule','Old schedule','{}','2026-03-01','monthly',1,'2026-03-01',1);
  `);
  journal.entries.slice(6, 7).forEach(migrate);
  journal.entries.slice(7, 8).forEach(migrate);
  db.exec(`
    insert into personal_group_cash_movements
      (id,group_id,expense_id,member_id,account_id,currency,amount,direction,date,
       description,group_name,expense_revision,created_at,voided_at)
      values('old-link','group','meal','a','cash','INR',500,'out','2026-03-01',
        'Meal','Legacy group',1,'2026-03-01T00:00:00.000Z','2026-03-02T00:00:00.000Z');
  `);
  journal.entries.slice(8, 9).forEach(migrate);
  db.exec(`
    insert into personal_budgets(id,name,month,currency,amount,threshold)
      values('old-budget','Food','2026-03','INR',5000,80);
  `);
  journal.entries.slice(9).forEach(migrate);
  assert.equal(
    db.prepare("select basis from personal_budgets where id='old-budget'").get().basis,
    'personal',
  );
  db.prepare("update personal_budgets set basis='combined' where id='old-budget'").run();
  assert.equal(
    db.prepare("select basis from personal_budgets where id='old-budget'").get().basis,
    'combined',
  );
  assert.deepEqual(
    {
      ...db
        .prepare(
          'select amount,personal_entry_id,voided_at from personal_group_cash_movements where id=?',
        )
        .get('old-link'),
    },
    { amount: 500, personal_entry_id: null, voided_at: '2026-03-02T00:00:00.000Z' },
  );
  assert.equal(
    db.prepare('select count(*) total from personal_group_cash_movements').get().total,
    1,
  );
  assert.deepEqual(balances(), before);
  assert.deepEqual(
    {
      ...db
        .prepare(
          'select amount,currency,entry_type,receipt_uri,receipt_uris,deleted_at from expenses',
        )
        .get(),
    },
    {
      amount: 12345,
      currency: 'INR',
      entry_type: 'expense',
      receipt_uri: 'file:///legacy.jpg',
      receipt_uris: '[]',
      deleted_at: null,
    },
  );
  assert.deepEqual(
    {
      ...db.prepare('select currency,sync_status,sync_user_id,owner_id from groups').get(),
    },
    { currency: 'INR', sync_status: 'local', sync_user_id: null, owner_id: null },
  );
  assert.equal(db.prepare('select count(*) total from group_operations').get().total, 0);
  assert.equal(db.prepare('select count(*) total from group_expenses').get().total, 2);
  assert.deepEqual(
    { ...db.prepare('select next_date,end_date,time_zone from personal_recurring_rules').get() },
    { next_date: '2026-03-01', end_date: null, time_zone: null },
  );
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);

  db.exec(`
    insert into personal_accounts(id,name,currency,opening_balance,created_at)
      values('cash','Cash','INR',10000,'2026-03-01T00:00:00.000Z');
    insert into personal_savings_goals(id,name,account_id,currency,target,created_at,updated_at)
      values('trip','Trip','cash','INR',5000,'2026-03-01T00:00:00.000Z','2026-03-01T00:00:00.000Z');
    insert into personal_goal_contributions(id,goal_id,amount,date,created_at)
      values('reserve','trip',1200,'2026-03-01','2026-03-01T00:00:00.000Z'),
        ('release','trip',-200,'2026-03-01','2026-03-01T00:00:00.000Z');
    insert into personal_group_cash_movements
      (id,group_id,expense_id,member_id,group_user_id,account_id,currency,amount,direction,date,
       description,group_name,expense_revision,created_at,voided_at)
      values('link','group','meal','a',null,'cash','INR',500,'out','2026-03-01',
        'Meal','Legacy group',1,'2026-03-01T00:00:00.000Z',null);
    update expenses set receipt_uris='["file:///legacy.jpg","file:///second.jpg"]';
  `);
  assert.deepEqual(
    {
      ...db
        .prepare(
          "select account_id,amount,direction,voided_at,personal_entry_id from personal_group_cash_movements where id='link'",
        )
        .get(),
    },
    { account_id: 'cash', amount: 500, direction: 'out', voided_at: null, personal_entry_id: null },
  );
  db.prepare('update personal_group_cash_movements set personal_entry_id=? where id=?').run(
    'personal',
    'link',
  );
  assert.equal(
    db.prepare("select personal_entry_id from personal_group_cash_movements where id='link'").get()
      .personal_entry_id,
    'personal',
  );
  db.prepare('update personal_group_cash_movements set voided_at=? where id=?').run(
    '2026-03-02T00:00:00.000Z',
    'link',
  );
  assert.equal(
    db
      .prepare('select count(*) total from personal_group_cash_movements where voided_at is null')
      .get().total,
    0,
  );
  assert.deepEqual(balances(), before);
  assert.equal(
    db.prepare('select sum(amount) saved from personal_goal_contributions').get().saved,
    1000,
  );
  assert.deepEqual(JSON.parse(db.prepare('select receipt_uris from expenses').get().receipt_uris), [
    'file:///legacy.jpg',
    'file:///second.jpg',
  ]);
  console.log(
    `PASS: ${journal.entries.length} bundled SQLite migrations preserve legacy amounts, balances, receipts and local ownership; savings, group cash snapshots and multi-photo fields persist.`,
  );
} finally {
  db.close();
}
