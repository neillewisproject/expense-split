import type { GroupWithDetails } from './group';
import { buildPersonLedgers } from './people';

function group(id: string, currency = 'INR'): GroupWithDetails {
  const now = '2026-11-23T00:00:00.000Z';
  return {
    id,
    name: id,
    currency,
    syncUserId: 'me',
    syncStatus: 'synced',
    meMemberId: 'a',
    archivedAt: null,
    createdAt: now,
    revision: 0,
    ownerId: 'me',
    localRevision: 0,
    inviteCode: null,
    conflictMessage: null,
    activity: [],
    members: ['a', 'b'].map((memberId, index) => ({
      id: memberId,
      userId: index === 0 ? 'me' : 'other',
      name: index === 0 ? 'Me' : 'Alice',
      groupId: id,
      createdAt: now,
      deactivatedAt: null,
    })),
    expenses: [
      {
        id: 'expense',
        description: 'Dinner',
        amount: 100,
        paidBy: 'a',
        contributions: { a: 100 },
        split: { b: 100 },
        currency,
        kind: 'expense',
        date: '2026-11-23',
        category: 'food',
        notes: '',
        method: '',
        reference: '',
        authorId: 'me',
        createdAt: now,
        updatedAt: now,
        revision: 1,
        deletedAt: null,
        splitInputs: null,
        itemized: null,
        conversion: null,
        receipts: [],
      },
    ],
  };
}

test('verified shared IDs link people while retaining every group/currency permission scope separately', () => {
  const result = buildPersonLedgers([group('trip'), group('dinner', 'USD')], 'me');
  expect(result).toHaveLength(1);
  expect(result[0]?.verifiedUserId).toBe('other');
  expect(
    result[0]?.scopes.map(({ groupId, currency, balance }) => ({ groupId, currency, balance })),
  ).toEqual([
    { groupId: 'trip', currency: 'INR', balance: 100 },
    { groupId: 'dinner', currency: 'USD', balance: 100 },
  ]);
});

test('same local/unclaimed participant names never merge identities', () => {
  const first = group('one');
  const second = group('two');
  first.syncUserId = null;
  second.syncUserId = null;
  first.syncStatus = 'local';
  second.syncStatus = 'local';
  expect(buildPersonLedgers([first, second], null)).toHaveLength(2);
  first.syncUserId = 'me';
  second.syncUserId = 'me';
  first.syncStatus = 'synced';
  second.syncStatus = 'synced';
  first.members[1]!.userId = null;
  second.members[1]!.userId = null;
  expect(buildPersonLedgers([first, second], 'me')).toHaveLength(2);
});

test('unverified me mappings, pending shared claims, and other account caches cannot establish identity', () => {
  const unclaimed = group('unclaimed');
  unclaimed.members[0]!.userId = null;
  const pending = group('pending');
  pending.syncStatus = 'pending';
  const otherAccount = group('other-account');
  otherAccount.syncUserId = 'other-account';
  expect(buildPersonLedgers([unclaimed, pending, otherAccount], 'me')).toEqual([]);
});
