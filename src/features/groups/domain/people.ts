import { computeBalances } from '@/features/expenses/domain/balances';
import type { GroupWithDetails } from './group';

export type PersonLedger = {
  key: string;
  verifiedUserId: string | null;
  names: string[];
  scopes: {
    groupId: string;
    groupName: string;
    currency: string;
    balance: number | null;
    archived: boolean;
    inactive: boolean;
  }[];
};

export function buildPersonLedgers(
  groups: GroupWithDetails[],
  userId: string | null,
): PersonLedger[] {
  const people = new Map<string, PersonLedger>();
  for (const group of groups) {
    if (group.members.length !== 2 || group.syncStatus === 'conflict') continue;
    const shared = !!group.syncUserId;
    if (shared && (group.syncUserId !== userId || group.syncStatus !== 'synced')) continue;
    const me = group.members.find((member) =>
      shared ? !!userId && member.userId === userId : member.id === group.meMemberId,
    );
    if (!me) continue;
    const other = group.members.find((member) => member.id !== me.id)!;
    const verifiedUserId = shared ? other.userId : null;
    const key = verifiedUserId
      ? `user:${userId}:${verifiedUserId}`
      : `scope:${group.id}:${other.id}`;
    const person = people.get(key) ?? { key, verifiedUserId, names: [], scopes: [] };
    if (!person.names.includes(other.name)) person.names.push(other.name);
    let balance: number | null = null;
    try {
      balance = computeBalances(group.expenses)[me.id] ?? 0;
    } catch {
      /* Never net an unrepresentable balance. */
    }
    person.scopes.push({
      groupId: group.id,
      groupName: group.name,
      currency: group.currency,
      balance,
      archived: !!group.archivedAt,
      inactive: !!other.deactivatedAt,
    });
    people.set(key, person);
  }
  return [...people.values()];
}
