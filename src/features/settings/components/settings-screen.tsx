import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { usePersonalStore } from '@/features/accounts/store';
import {
  Action,
  Choices,
  Failure,
  Field,
  PersonalPage,
  message,
} from '@/features/expenses/components/personal-ui';
import {
  EXPENSE_CATEGORIES,
  categoryLabel,
  parseTags,
  type ExpenseCategory,
} from '@/features/expenses/domain/expense';

export function PersonalSettingsScreen() {
  const defaultCurrency = usePersonalStore((state) => state.defaultCurrency);
  const categories = usePersonalStore((state) => state.categories);
  const loaded = usePersonalStore((state) => state.loaded);
  const load = usePersonalStore((state) => state.load);
  const save = usePersonalStore((state) => state.saveSettings);
  const storeError = usePersonalStore((state) => state.error);
  const rules = usePersonalStore((state) => state.categoryRules);
  const changeRule = usePersonalStore((state) => state.changeCategoryRule);
  const [currencyDraft, setCurrency] = useState<string | null>(null);
  const [customDraft, setCustom] = useState<string | null>(null);
  const currency = currencyDraft ?? defaultCurrency;
  const custom = customDraft ?? categories.join(', ');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [contains, setContains] = useState('');
  const [ruleType, setRuleType] = useState<'expense' | 'income'>('expense');
  const [ruleCategory, setRuleCategory] = useState<ExpenseCategory>('food');
  const ruleCategories: ExpenseCategory[] = [
    ...EXPENSE_CATEGORIES,
    ...categories.map((name) => `custom:${name}` as const),
  ];
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  async function run(operation: () => Promise<void>, success: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await operation();
      setFeedback(success);
    } catch (cause) {
      setFeedback(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PersonalPage title="Personal preferences">
      <ThemedText>
        Personal transactions remain on this device. No personal cloud upload, live exchange-rate
        service, biometric lock, or OS notifications are enabled by these settings.
      </ThemedText>
      <Failure message={storeError} />
      <Action label="Refresh preferences" disabled={busy} onPress={() => void load()} />
      <Field
        label="Default currency"
        value={currency}
        onChange={(value) => setCurrency(value.toUpperCase())}
      />
      <Field
        label="Custom categories (comma separated)"
        value={custom}
        onChange={setCustom}
        multiline
      />
      <ThemedText>
        Removing a custom category from this list does not change historical transactions. Tags and
        notes can be edited on each transaction.
      </ThemedText>
      <Action
        label="Save preferences"
        disabled={busy || !loaded || !!storeError}
        onPress={() => void run(() => save(currency, parseTags(custom)), 'Preferences saved')}
      />
      <ThemedText type="subtitle">Description categorization rules</ThemedText>
      <ThemedText>
        Literal, case-insensitive description matching. The first matching rule has priority.
        Suggestions require a tap in the transaction form; existing records, refunds, transfers and
        recurring drafts are never recategorized automatically.
      </ThemedText>
      {rules.map((rule, index) => (
        <CategoryRuleControls
          key={rule.id}
          label={`${index + 1}. ${rule.entryType}: “${rule.contains}” → ${categoryLabel(rule.category)}`}
          earlier={() =>
            void run(
              () => changeRule({ type: 'move', id: rule.id, offset: -1 }),
              'Rule priority updated',
            )
          }
          later={() =>
            void run(
              () => changeRule({ type: 'move', id: rule.id, offset: 1 }),
              'Rule priority updated',
            )
          }
          remove={() => void run(() => changeRule({ type: 'remove', id: rule.id }), 'Rule removed')}
          first={index === 0}
          last={index === rules.length - 1}
          disabled={busy || !loaded || !!storeError}
        />
      ))}
      <Field label="Description contains" value={contains} onChange={setContains} />
      <Choices
        value={ruleType}
        onChange={(value) => setRuleType(value === 'income' ? 'income' : 'expense')}
        values={[
          { value: 'expense', label: 'Expense rule' },
          { value: 'income', label: 'Income rule' },
        ]}
      />
      <Choices
        value={ruleCategory}
        onChange={(value) => {
          const option = ruleCategories.find((category) => category === value);
          if (option) setRuleCategory(option);
        }}
        values={ruleCategories.map((category) => ({
          value: category,
          label: categoryLabel(category),
        }))}
      />
      <Action
        label="Add category rule"
        disabled={busy || !loaded || !!storeError}
        onPress={() =>
          void run(async () => {
            if (!ruleCategories.includes(ruleCategory))
              throw new Error('Choose an available category before adding the rule');
            await changeRule({
              type: 'add',
              rule: { contains, entryType: ruleType, category: ruleCategory },
            });
            setContains('');
          }, 'Category rule added')
        }
      />
      {feedback ? <ThemedText accessibilityRole="alert">{feedback}</ThemedText> : null}
    </PersonalPage>
  );
}

function CategoryRuleControls({
  label,
  earlier,
  later,
  remove,
  first,
  last,
  disabled,
}: {
  label: string;
  earlier: () => void;
  later: () => void;
  remove: () => void;
  first: boolean;
  last: boolean;
  disabled: boolean;
}) {
  return (
    <>
      <ThemedText>{label}</ThemedText>
      <Action label={`Move earlier: ${label}`} disabled={disabled || first} onPress={earlier} />
      <Action label={`Move later: ${label}`} disabled={disabled || last} onPress={later} />
      <Action label={`Remove rule: ${label}`} disabled={disabled} onPress={remove} />
    </>
  );
}
