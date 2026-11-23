import type { Account } from '../data/schema';
import type { StoredExpense } from '@/features/expenses/data/schema';
import { expenseFormSchema, parseTags } from '@/features/expenses/domain/expense';
import { validateEntry } from '@/features/expenses/domain/ledger';

export type BulkAction =
  { type: 'category'; category: string } | { type: 'tags'; tags: string } | { type: 'trash' };

export function prepareBulkChange(
  entries: StoredExpense[],
  ids: string[],
  action: BulkAction,
  accounts: Account[],
  now: string,
): StoredExpense[] {
  const selected = new Set(ids);
  if (!selected.size || selected.size !== ids.length)
    throw new Error('Select one or more distinct transactions');
  if (ids.some((id) => !entries.some((entry) => entry.id === id && !entry.deletedAt)))
    throw new Error(
      'A selected transaction is missing or already in trash. Review your selection.',
    );
  const category =
    action.type === 'category'
      ? expenseFormSchema.shape.category.parse(action.category)
      : undefined;
  const tags = action.type === 'tags' ? parseTags(action.tags) : [];
  if (action.type === 'tags' && !tags.length) throw new Error('Enter at least one tag to add');
  const next = entries.map((entry) => {
    if (!selected.has(entry.id)) return entry;
    if (action.type === 'trash') return { ...entry, deletedAt: now, updatedAt: now };
    if (action.type === 'category') return { ...entry, category: category!, updatedAt: now };
    const existing = JSON.parse(entry.tags ?? '[]') as string[];
    return { ...entry, tags: JSON.stringify([...new Set([...existing, ...tags])]), updatedAt: now };
  });
  if (
    action.type === 'trash' &&
    next.some((entry) => !entry.deletedAt && entry.refundOfId && selected.has(entry.refundOfId))
  ) {
    throw new Error('Select linked refunds too before trashing their original expense');
  }
  for (const entry of next) {
    if (selected.has(entry.id) && !entry.deletedAt)
      validateEntry(
        entry,
        accounts.map((account) => ({ ...account, archived: false })),
        next,
        entry.id,
      );
  }
  return next.filter((entry) => selected.has(entry.id));
}
