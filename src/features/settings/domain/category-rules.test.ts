import { changeCategoryRules, parseCategoryRules, suggestedCategoryRule } from './category-rules';

it('matches normalized literal descriptions by type and explicit priority', () => {
  const rules = parseCategoryRules(
    JSON.stringify([
      { id: 'general', contains: 'train', entryType: 'expense', category: 'transport' },
      { id: 'specific', contains: 'train cafe', entryType: 'expense', category: 'food' },
      { id: 'salary', contains: 'payroll', entryType: 'income', category: 'other' },
    ]),
  );
  expect(suggestedCategoryRule(rules, '  TRAIN   CAFE  ')?.id).toBe('general');
  const reordered = changeCategoryRules(
    rules,
    { type: 'move', id: 'specific', offset: -1 },
    'unused',
  );
  expect(suggestedCategoryRule(reordered, 'Train cafe')?.category).toBe('food');
  expect(suggestedCategoryRule(rules, 'payroll', 'income')?.id).toBe('salary');
  expect(suggestedCategoryRule(rules, 'train', 'refund')).toBeUndefined();
  expect(suggestedCategoryRule(rules, 'train', 'transfer')).toBeUndefined();
  expect(changeCategoryRules(rules, { type: 'remove', id: 'general' }, 'unused')).toHaveLength(2);
});

it('rejects duplicate normalized patterns and invalid persisted data', () => {
  const rule = {
    id: 'a',
    contains: 'Cafe',
    entryType: 'expense' as const,
    category: 'food' as const,
  };
  expect(() =>
    changeCategoryRules([rule], { type: 'add', rule: { ...rule, contains: 'ＣＡＦＥ' } }, 'b'),
  ).toThrow('distinct');
  expect(() => parseCategoryRules('{')).toThrow('invalid');
  expect(() => changeCategoryRules([rule], { type: 'remove', id: 'missing' }, 'unused')).toThrow(
    'no longer exists',
  );
  const literal = { ...rule, contains: '.*' };
  expect(suggestedCategoryRule([literal], 'Cafe')).toBeUndefined();
  expect(suggestedCategoryRule([literal], 'Literal .* receipt')?.id).toBe('a');
});
