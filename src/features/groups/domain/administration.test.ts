import { assertAdministrativeReady } from './administration';
import type { GroupWithDetails } from './group';

const group = { syncUserId: 'owner', syncStatus: 'synced', ownerId: 'owner' } as GroupWithDetails;

test('administrative changes require the matching account and an entirely acknowledged local queue', () => {
  expect(() => assertAdministrativeReady(group, 'owner', 0, true)).not.toThrow();
  expect(() => assertAdministrativeReady(group, 'other', 0, false)).toThrow(/account/);
  expect(() => assertAdministrativeReady(group, 'owner', 1, false)).toThrow(/pending/);
  expect(() =>
    assertAdministrativeReady({ ...group, syncStatus: 'conflict' }, 'owner', 0, true),
  ).toThrow(/pending/);
  expect(() => assertAdministrativeReady({ ...group, ownerId: 'other' }, 'owner', 0, true)).toThrow(
    /owner/,
  );
  expect(() =>
    assertAdministrativeReady({ ...group, ownerId: 'other' }, 'owner', 0, false),
  ).not.toThrow();
});
