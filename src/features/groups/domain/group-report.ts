import { computeBalances, simplifyDebts } from '@/features/expenses/domain/balances';
import { safeSum } from '@/features/expenses/domain/ledger';
import { formatMoney } from '@/features/expenses/domain/money';
import type { GroupWithDetails } from './group';

export function groupReport(group: GroupWithDetails) {
  const balances = computeBalances(group.expenses);
  const members = Object.fromEntries(
    group.members.map((member) => [
      member.id,
      { paid: 0, consumed: 0, settlementsSent: 0, settlementsReceived: 0, balance: 0 },
    ]),
  );
  const totalExpenses: number[] = [];
  const totalSettlements: number[] = [];
  for (const entry of group.expenses) {
    if (entry.deletedAt) continue;
    if (entry.currency !== group.currency) throw new Error('Group report has a currency mismatch');
    const settlement = entry.kind === 'settlement';
    const sign = entry.kind === 'refund' ? -1 : 1;
    (settlement ? totalSettlements : totalExpenses).push(sign * entry.amount);
    for (const [id, value] of Object.entries(entry.contributions)) {
      const member = members[id];
      if (!member) throw new Error('Group report references a missing participant');
      if (settlement) member.settlementsSent = safeSum([member.settlementsSent, value]);
      else member.paid = safeSum([member.paid, sign * value]);
    }

    for (const [id, value] of Object.entries(entry.split)) {
      const member = members[id];
      if (!member) throw new Error('Group report references a missing participant');
      if (settlement) member.settlementsReceived = safeSum([member.settlementsReceived, value]);
      else member.consumed = safeSum([member.consumed, sign * value]);
    }
  }
  for (const [id, member] of Object.entries(members)) member.balance = balances[id] ?? 0;
  return {
    spending: safeSum(totalExpenses),
    settlements: safeSum(totalSettlements),
    members,
  };
}

export function groupSummary(group: GroupWithDetails): string {
  const report = groupReport(group);
  const membersById = new Map(group.members.map((member) => [member.id, member]));
  const balances = Object.fromEntries(
    group.members.map((member) => [member.id, report.members[member.id]!.balance]),
  );
  const suggestions = simplifyDebts(balances);
  return [
    `Group: ${group.name}`,
    `Net group spending: ${formatMoney(report.spending, group.currency)}`,
    `Recorded settlements: ${formatMoney(report.settlements, group.currency)}`,
    '',
    'Balances (positive receives, negative owes):',
    ...group.members.map(
      (member) =>
        `${member.name}${member.deactivatedAt ? ' (inactive)' : ''}: ${formatMoney(balances[member.id]!, group.currency)}`,
    ),
    '',
    'Suggested repayments (simplified, not guaranteed fewest transfers):',
    ...(suggestions.length
      ? suggestions.map(
          (payment) =>
            `${membersById.get(payment.from)!.name} pays ${membersById.get(payment.to)!.name} ${formatMoney(payment.amount, group.currency)}`,
        )
      : ['None']),
    '',
    'Informational only. No payment is sent or verified.',
  ].join('\n');
}
