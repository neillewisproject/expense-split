import type { GroupExpense, GroupLedger, GroupWithDetails } from './group';
import { calculateSavedSplit } from './split-inputs';
import { convertGroupAllocation } from './conversion';
import { getCurrencyExponent } from '@/features/expenses/domain/money';

export function canManageGroup(group: GroupWithDetails, userId: string | null): boolean {
  return !group.syncUserId || group.ownerId === userId;
}

export function canEditExpense(
  group: GroupWithDetails,
  expense: GroupExpense,
  userId: string | null,
): boolean {
  return canManageGroup(group, userId) || (userId !== null && expense.authorId === userId);
}

export function validateGroupExpense(
  group: GroupLedger,
  expense: Omit<GroupExpense, 'receipts'>,
): void {
  const members = new Set(group.members.map((member) => member.id));
  if (!expense.description.trim() || expense.description.trim().length > 80) {
    throw new Error('Enter a description with 1–80 characters.');
  }
  const date = new Date(`${expense.date}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== expense.date) {
    throw new Error('Enter a valid date in YYYY-MM-DD format.');
  }
  if (expense.currency !== group.currency) throw new Error('Use the group base currency.');
  if (!Number.isSafeInteger(expense.amount) || expense.amount <= 0 || expense.amount > 2147483647) {
    throw new Error('Enter a positive amount within the supported shared-ledger limit.');
  }
  if (!members.has(expense.paidBy)) throw new Error('Choose a payer in this group.');
  if (expense.kind === 'refund' && (!expense.refundOfId || !expense.refundSnapshot)) {
    throw new Error('Refunds must link to an original expense and retain its historical snapshot.');
  }
  for (const allocation of [expense.split, expense.contributions]) {
    const entries = Object.entries(allocation);
    if (
      !entries.length ||
      entries.some(
        ([id, amount]) => !members.has(id) || !Number.isSafeInteger(amount) || amount < 0,
      ) ||
      entries.reduce((sum, [, amount]) => sum + BigInt(amount), 0n) !== BigInt(expense.amount)
    ) {
      throw new Error('Payer contributions and owed amounts must each add up to the total.');
    }
  }
  if (!(expense.contributions[expense.paidBy]! > 0))
    throw new Error('The selected payer must contribute to the expense.');
  if (expense.splitInputs) {
    const { memberIds, values } = expense.splitInputs;
    if (
      !memberIds.length ||
      new Set(memberIds).size !== memberIds.length ||
      memberIds.some((id) => !members.has(id)) ||
      Object.keys(values).some((id) => !memberIds.includes(id))
    ) {
      throw new Error('Saved split inputs must reference selected group participants.');
    }
    const calculated = calculateSavedSplit(expense.amount, expense.splitInputs, expense.itemized);
    const ids = new Set([...Object.keys(calculated), ...Object.keys(expense.split)]);
    if ([...ids].some((id) => (calculated[id] ?? 0) !== (expense.split[id] ?? 0))) {
      throw new Error('Saved split inputs do not match the allocated amounts.');
    }
  }
  if (expense.kind === 'settlement') {
    const payers = Object.entries(expense.contributions).filter(([, amount]) => amount > 0);
    const recipients = Object.entries(expense.split).filter(([, amount]) => amount > 0);
    if (payers.length !== 1 || recipients.length !== 1 || payers[0]![0] === recipients[0]![0]) {
      throw new Error('A settlement needs one sender and a different recipient.');
    }
  }
  if (expense.conversion) {
    const conversion = expense.conversion;
    if (
      conversion.originalExponent !== getCurrencyExponent(conversion.originalCurrency) ||
      conversion.baseExponent !== getCurrencyExponent(group.currency)
    )
      throw new Error('Conversion currency precision does not match the saved currencies.');
    const originalIds = [
      ...Object.keys(conversion.originalSplit),
      ...Object.keys(conversion.originalContributions),
    ];
    if (originalIds.some((id) => !members.has(id)))
      throw new Error('Original allocations must belong to this group.');
    const original = {
      ...expense,
      amount: conversion.originalAmount,
      currency: conversion.originalCurrency,
      split: conversion.originalSplit,
      contributions: conversion.originalContributions,
      splitInputs: conversion.splitInputs,
      itemized: conversion.itemized,
      conversion: null,
    };
    validateGroupExpense({ ...group, currency: conversion.originalCurrency }, original);
    const convertedSplit = convertGroupAllocation(
      conversion.originalAmount,
      conversion.originalSplit,
      conversion.originalCurrency,
      group.currency,
      conversion.rate,
    );
    const convertedPayers = convertGroupAllocation(
      conversion.originalAmount,
      conversion.originalContributions,
      conversion.originalCurrency,
      group.currency,
      conversion.rate,
    );
    if (
      convertedSplit.total !== expense.amount ||
      convertedPayers.total !== expense.amount ||
      [convertedSplit.parts, convertedPayers.parts].some((parts, index) => {
        const actual = index === 0 ? expense.split : expense.contributions;
        return [...new Set([...Object.keys(parts), ...Object.keys(actual)])].some(
          (id) => (parts[id] ?? 0) !== (actual[id] ?? 0),
        );
      })
    )
      throw new Error('Stored base allocations do not match the fixed original exchange rate.');
  }
}
