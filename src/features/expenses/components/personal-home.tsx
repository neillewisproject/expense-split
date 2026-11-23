import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePersonalStore } from '@/features/accounts/store';
import { periodReport } from '@/features/reports/domain/reports';
import { categoryLabel, EXPENSE_CATEGORIES, localDate } from '../domain/expense';
import { filterEntries } from '../domain/ledger';
import { formatMoney, parseAmount } from '../domain/money';
import { useExpensesStore } from '../store';
import { ExpenseList } from './expense-list';
import { Action, Choices, Failure, Field, message } from './personal-ui';
import { prepareBulkChange, type BulkAction } from '@/features/accounts/domain/bulk';
import { validatePeriod } from '@/features/reports/domain/periods';

export function PersonalHome() {
  const params = useLocalSearchParams<{
    month?: string;
    currency?: string;
    start?: string;
    end?: string;
  }>();
  return (
    <PersonalLedger
      key={`${params.month ?? ''}:${params.currency ?? ''}:${params.start ?? ''}:${params.end ?? ''}`}
      initialMonth={params.month ?? ''}
      initialCurrency={params.currency ?? ''}
      initialStart={params.start ?? ''}
      initialEnd={params.end ?? ''}
    />
  );
}

function PersonalLedger({
  initialMonth,
  initialCurrency,
  initialStart,
  initialEnd,
}: {
  initialMonth: string;
  initialCurrency: string;
  initialStart: string;
  initialEnd: string;
}) {
  const entries = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const storeError = useExpensesStore((state) => state.error);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const remove = useExpensesStore((state) => state.deleteExpense);
  const restore = useExpensesStore((state) => state.restoreExpense);
  const accounts = usePersonalStore((state) => state.accounts);
  const categories = usePersonalStore((state) => state.categories);
  const bulkChange = usePersonalStore((state) => state.bulkChange);
  const generate = usePersonalStore((state) => state.generateDue);
  const drafts = usePersonalStore((state) => state.drafts);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(initialMonth);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [currency, setCurrency] = useState(initialCurrency);
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [accountId, setAccountId] = useState('');
  const [tag, setTag] = useState('');
  const [receipt, setReceipt] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sort, setSort] = useState('newest');
  const [trash, setTrash] = useState(false);
  const [filters, setFilters] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkType, setBulkType] = useState<'category' | 'tags' | 'trash'>('category');
  const [bulkCategory, setBulkCategory] = useState('other');
  const [bulkTags, setBulkTags] = useState('');
  const [plan, setPlan] = useState<{ ids: string[]; action: BulkAction } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  function invalidatePlan() {
    setPlan(null);
    setConfirmation('');
  }
  function cancelSelection() {
    setSelecting(false);
    setSelected([]);
    invalidatePlan();
  }
  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    invalidatePlan();
  }
  useEffect(() => {
    if (status === 'idle') void loadEntries();
  }, [status, loadEntries]);
  useEffect(() => {
    const check = () => {
      void generate().catch((err: unknown) => setError(message(err)));
    };
    check();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => listener.remove();
  }, [generate]);
  const result = useMemo(() => {
    try {
      if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Use YYYY-MM for month');
      if (start || end) validatePeriod({ start, end });
      if (currency) formatMoney(0, currency);
      if (sort === 'amount' && !currency)
        throw new Error('Choose one currency before sorting by amount');
      if ((min || max) && !currency) throw new Error('Choose a currency before filtering amounts');
      const minAmount = min ? parseAmount(min, currency) : undefined;
      const maxAmount = max ? parseAmount(max, currency) : undefined;
      if (minAmount === null || maxAmount === null) throw new Error('Enter valid filter amounts');
      if (minAmount !== undefined && maxAmount !== undefined && minAmount > maxAmount)
        throw new Error('Minimum exceeds maximum amount');
      return {
        rows: filterEntries(entries, {
          search,
          month,
          currency,
          entryType: type,
          category,
          accountId,
          tag,
          trash,
          minAmount,
          maxAmount,
          sort: sort as 'newest' | 'oldest' | 'amount',
          receipt: (receipt || undefined) as 'yes' | 'no' | undefined,
        }).filter((entry) => (!start || entry.date >= start) && (!end || entry.date <= end)),
        error: null,
      };
    } catch (err) {
      return { rows: [], error: message(err) };
    }
  }, [
    entries,
    search,
    month,
    currency,
    type,
    category,
    accountId,
    tag,
    trash,
    min,
    max,
    sort,
    receipt,
    start,
    end,
  ]);
  const summary = useMemo(() => {
    try {
      return [
        ...new Set(
          entries.filter((entry) => !entry.deletedAt).map((entry) => entry.currency ?? 'INR'),
        ),
      ]
        .map((code) => {
          const report = periodReport(entries, localDate().slice(0, 7), code);
          return `${code}: ${formatMoney(report.spending, code)} net spent`;
        })
        .join(' · ');
    } catch (err) {
      return message(err);
    }
  }, [entries]);
  async function mutate(id: string) {
    setError(null);
    try {
      if (trash) await restore(id);
      else await remove(id);
    } catch (err) {
      setError(message(err));
    }
  }
  function reviewBulk() {
    setError(null);
    invalidatePlan();
    try {
      const action: BulkAction =
        bulkType === 'category'
          ? { type: 'category', category: bulkCategory }
          : bulkType === 'tags'
            ? { type: 'tags', tags: bulkTags }
            : { type: 'trash' };
      prepareBulkChange(entries, selected, action, accounts, new Date().toISOString());
      setPlan({ ids: [...selected], action });
    } catch (err) {
      setError(message(err));
    }
  }
  async function applyBulk() {
    if (!plan || confirmation !== `APPLY ${plan.ids.length}`) return;
    setBusy(true);
    setError(null);
    try {
      await bulkChange(plan.ids, plan.action);
      cancelSelection();
    } catch (err) {
      setError(message(err));
      invalidatePlan();
    } finally {
      setBusy(false);
    }
  }
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ThemedText type="subtitle">Personal ledger</ThemedText>
        <ThemedText type="small">This month · {summary || 'No spending yet'}</ThemedText>
        <ScrollView horizontal style={styles.links} contentContainerStyle={{ gap: Spacing.two }}>
          {(
            [
              'accounts',
              'budgets',
              'goals',
              'reports',
              'recurring',
              'import-export',
              'personal-settings',
              'privacy',
              'personal-cloud',
              'spending-by-category',
            ] as const
          ).map((route) => (
            <Pressable
              key={route}
              accessibilityRole="button"
              style={styles.nav}
              onPress={() => router.push(`/${route}` as Href)}>
              <ThemedText type="linkPrimary">{route.replaceAll('-', ' ')}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        {drafts.some((draft) => draft.status === 'pending') ? (
          <Action
            label={`${drafts.filter((draft) => draft.status === 'pending').length} recurring drafts need approval`}
            onPress={() => router.push('/recurring')}
          />
        ) : null}
        <Field
          label="Search description, notes, tags"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPageSize(50);
          }}
        />
        <View style={styles.linksRow}>
          <Action
            label={filters ? 'Hide filters' : 'Search filters'}
            onPress={() => setFilters(!filters)}
          />
          <Action
            label={trash ? 'Show active' : 'Trash / restore'}
            onPress={() => {
              setTrash(!trash);
              cancelSelection();
            }}
          />
        </View>
        {filters ? (
          <ScrollView style={styles.filters} keyboardShouldPersistTaps="handled">
            <Field label="Month (YYYY-MM, optional)" value={month} onChange={setMonth} />
            <Field label="From date (YYYY-MM-DD, optional)" value={start} onChange={setStart} />
            <Field label="Through date (YYYY-MM-DD, optional)" value={end} onChange={setEnd} />
            <Field
              label="Currency (optional)"
              value={currency}
              onChange={(value) => setCurrency(value.toUpperCase())}
            />
            <Choices
              value={type}
              onChange={setType}
              values={['', 'expense', 'income', 'refund', 'transfer'].map((value) => ({
                value,
                label: value || 'All types',
              }))}
            />
            <Field
              label="Category key (food or custom:Name)"
              value={category}
              onChange={setCategory}
            />
            <Choices
              value={accountId}
              onChange={setAccountId}
              values={[
                { value: '', label: 'All accounts' },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
            <Field label="Exact tag" value={tag} onChange={setTag} />
            <Field label="Minimum amount" value={min} onChange={setMin} />
            <Field label="Maximum amount" value={max} onChange={setMax} />
            <Choices
              value={receipt}
              onChange={setReceipt}
              values={[
                { value: '', label: 'Any receipt' },
                { value: 'yes', label: 'Has receipt' },
                { value: 'no', label: 'No receipt' },
              ]}
            />
            <Choices
              value={sort}
              onChange={setSort}
              values={['newest', 'oldest', 'amount'].map((value) => ({ value, label: value }))}
            />
            {sort === 'amount' && !currency ? (
              <ThemedText>
                Amount sorting compares minor units; select one currency for meaningful comparisons.
              </ThemedText>
            ) : null}
            <Action
              label="Clear filters"
              onPress={() => {
                setSearch('');
                setMonth('');
                setStart('');
                setEnd('');
                setCurrency('');
                setType('');
                setCategory('');
                setAccountId('');
                setTag('');
                setMin('');
                setMax('');
                setReceipt('');
              }}
            />
          </ScrollView>
        ) : null}
        <Failure message={error ?? result.error ?? storeError} />
        {start || end ? (
          <ThemedText type="small">
            Date filter: {start} through {end} inclusive
          </ThemedText>
        ) : null}
        {!trash ? (
          <Action
            label={selecting ? 'Cancel bulk selection' : 'Select for bulk actions'}
            disabled={busy}
            onPress={() => {
              if (selecting) cancelSelection();
              else setSelecting(true);
            }}
          />
        ) : null}
        {selecting ? (
          <ScrollView style={styles.bulkPanel} keyboardShouldPersistTaps="handled">
            <ThemedText type="smallBold">
              {selected.length} explicitly selected across filters
            </ThemedText>
            <Action
              label={`Select displayed page (${Math.min(pageSize, result.rows.length)})`}
              disabled={busy}
              onPress={() => {
                setSelected((current) => [
                  ...new Set([
                    ...current,
                    ...result.rows.slice(0, pageSize).map((entry) => entry.id),
                  ]),
                ]);
                invalidatePlan();
              }}
            />
            <Action
              label="Clear all selections"
              disabled={busy}
              onPress={() => {
                setSelected([]);
                invalidatePlan();
              }}
            />
            <Choices
              value={bulkType}
              onChange={(value) => {
                setBulkType(value as typeof bulkType);
                invalidatePlan();
              }}
              values={[
                { value: 'category', label: 'Recategorize' },
                { value: 'tags', label: 'Add tags' },
                { value: 'trash', label: 'Move to trash' },
              ]}
            />
            {bulkType === 'category' ? (
              <Choices
                value={bulkCategory}
                onChange={(value) => {
                  setBulkCategory(value);
                  invalidatePlan();
                }}
                values={[...EXPENSE_CATEGORIES, ...categories.map((name) => `custom:${name}`)].map(
                  (value) => ({ value, label: categoryLabel(value) }),
                )}
              />
            ) : null}
            {bulkType === 'tags' ? (
              <Field
                label="Bulk tags to add (comma separated)"
                value={bulkTags}
                onChange={(value) => {
                  setBulkTags(value);
                  invalidatePlan();
                }}
              />
            ) : null}
            <ThemedText type="small">
              Tags are added without removing existing tags. Category changes must include linked
              refunds where needed; trashing an original requires selecting its active refunds too.
              All selected changes commit together or none do.
            </ThemedText>
            <Action
              label={`Review ${selected.length} selected changes`}
              disabled={busy || !selected.length}
              onPress={reviewBulk}
            />
            {plan ? (
              <>
                <ThemedText type="smallBold">
                  Confirm{' '}
                  {plan.action.type === 'category'
                    ? `category → ${categoryLabel(plan.action.category)}`
                    : plan.action.type === 'tags'
                      ? `add tags: ${plan.action.tags}`
                      : 'move to recoverable trash'}
                </ThemedText>
                {plan.ids.map((id) => (
                  <ThemedText key={id} type="small">
                    {entries.find((entry) => entry.id === id)?.date} ·{' '}
                    {entries.find((entry) => entry.id === id)?.description ?? id}
                  </ThemedText>
                ))}
                <Field
                  label={`Type APPLY ${plan.ids.length} to confirm`}
                  value={confirmation}
                  onChange={setConfirmation}
                />
                <Action
                  label="Apply confirmed bulk changes"
                  disabled={busy || confirmation !== `APPLY ${plan.ids.length}`}
                  onPress={() => void applyBulk()}
                />
              </>
            ) : null}
          </ScrollView>
        ) : null}
        {status === 'error' ? (
          <Action label="Retry loading transactions" onPress={() => void loadEntries()} />
        ) : null}
        {trash ? (
          <ThemedText type="small">
            Tap a transaction to view it; swipe and tap Restore to recover it.
          </ThemedText>
        ) : null}
        <View style={{ flex: 1 }}>
          {status === 'loading' && entries.length === 0 ? (
            <ThemedText>Loading personal transactions…</ThemedText>
          ) : selecting ? (
            <FlatList
              data={result.rows.slice(0, pageSize)}
              keyExtractor={(entry) => entry.id}
              ListEmptyComponent={<ThemedText>No matching transactions</ThemedText>}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Select ${item.description}, ${item.date}`}
                  accessibilityState={{ checked: selected.includes(item.id), disabled: busy }}
                  disabled={busy}
                  onPress={() => toggleSelected(item.id)}
                  style={styles.selectionRow}>
                  <ThemedText>
                    {selected.includes(item.id) ? '☑' : '☐'} {item.description} · {item.date} ·{' '}
                    {formatMoney(item.amount, item.currency ?? 'INR')}
                  </ThemedText>
                </Pressable>
              )}
            />
          ) : (
            <ExpenseList
              expenses={result.rows.slice(0, pageSize)}
              onDelete={(id) => void mutate(id)}
              onSelect={(id) => router.push({ pathname: '/expenses/[id]', params: { id } })}
            />
          )}
        </View>
        {result.rows.length > pageSize ? (
          <Action
            label={`Show more (${result.rows.length - pageSize} remaining)`}
            onPress={() => setPageSize(pageSize + 50)}
          />
        ) : null}
        <Action label="+ Add transaction" onPress={() => router.push('/add-expense')} />
      </SafeAreaView>
    </ThemedView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    paddingBottom: BottomTabInset,
  },
  links: { flexGrow: 0, maxHeight: 48 },
  nav: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.one },
  linksRow: { flexDirection: 'row', gap: Spacing.two },
  filters: { maxHeight: 220, flexGrow: 0 },
  bulkPanel: { maxHeight: 230, flexGrow: 0 },
  selectionRow: { minHeight: 52, paddingVertical: Spacing.two },
});
