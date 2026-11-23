import { z } from 'zod';
import { expenseFormSchema } from '@/features/expenses/domain/expense';

const normalize = (value: string) =>
  value.normalize('NFKC').toLowerCase().trim().replace(/\s+/g, ' ');

export const categoryRuleSchema = z
  .object({
    id: z.string().min(1).max(200),
    contains: z.string().trim().min(1).max(80),
    entryType: z.enum(['expense', 'income']),
    category: expenseFormSchema.shape.category,
  })
  .strict();

export const categoryRulesSchema = z
  .array(categoryRuleSchema)
  .max(50)
  .superRefine((rules, context) => {
    const ids = new Set<string>();
    const patterns = new Set<string>();
    for (const rule of rules) {
      const key = JSON.stringify([rule.entryType, normalize(rule.contains)]);
      if (ids.has(rule.id) || patterns.has(key)) {
        context.addIssue({
          code: 'custom',
          message:
            'Category rules must have distinct IDs and description patterns per transaction type',
        });
      }
      ids.add(rule.id);
      patterns.add(key);
    }
  });

export type CategoryRule = z.infer<typeof categoryRuleSchema>;
export type CategoryRuleAction =
  | { type: 'add'; rule: Omit<CategoryRule, 'id'> }
  | { type: 'remove'; id: string }
  | { type: 'move'; id: string; offset: -1 | 1 };

export function parseCategoryRules(text: string): CategoryRule[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Category rule data is invalid');
  }
  const result = categoryRulesSchema.safeParse(value);
  if (!result.success)
    throw new Error(result.error.issues[0]?.message ?? 'Category rule data is invalid');
  return result.data;
}

export function changeCategoryRules(
  rules: CategoryRule[],
  action: CategoryRuleAction,
  newId: string,
): CategoryRule[] {
  const next = [...rules];
  if (action.type === 'add') next.push({ ...action.rule, id: newId });
  else {
    const index = next.findIndex((rule) => rule.id === action.id);
    if (index < 0) throw new Error('Category rule no longer exists; refresh preferences');
    if (action.type === 'remove') next.splice(index, 1);
    else {
      const target = index + action.offset;
      if (target < 0 || target >= next.length)
        throw new Error('Category rule is already at that priority boundary');
      [next[index], next[target]] = [next[target]!, next[index]!];
    }
  }
  return parseCategoryRules(JSON.stringify(next));
}

export function suggestedCategoryRule(
  rules: CategoryRule[],
  description: string,
  entryType: string = 'expense',
): CategoryRule | undefined {
  if (entryType !== 'expense' && entryType !== 'income') return undefined;
  const text = normalize(description);
  return rules.find(
    (rule) => rule.entryType === entryType && text.includes(normalize(rule.contains)),
  );
}
