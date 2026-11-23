import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import {
  Banner,
  Button,
  Card,
  ChipGroup,
  Fab,
  IconButton,
  Screen,
  ScreenHeader,
  SearchBar,
  SectionHeader,
  Sheet,
} from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { prepareBulkChange, type BulkAction } from '@/features/accounts/domain/bulk';
import { usePersonalStore } from '@/features/accounts/store';
import { useDueRecurring } from '@/features/recurrence/use-due-recurring';
import { validatePeriod } from '@/features/reports/domain/periods';
import { periodReport } from '@/features/reports/domain/reports';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel, EXPENSE_CATEGORIES, localDate } from '../domain/expense';
import { filterEntries } from '../domain/ledger';
import { formatMoney, parseAmount } from '../domain/money';
import { useExpensesStore } from '../store';
import { ExpenseList, TransactionRow } from './expense-list';
import { Action, Choices, Failure, Field, message } from './personal-ui';

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
  const theme = useTheme();
  const entries = useExpensesStore((state) => state.expenses);
  const status = useExpensesStore((state) => state.status);
  const storeError = useExpensesStore((state) => state.error);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const remove = useExpensesStore((state) => state.deleteExpense);
  const restore = useExpensesStore((state) => state.restoreExpense);
  const accounts = usePersonalStore((state) => state.accounts);
  const categories = usePersonalStore((state) => state.categories);
  const bulkChange = usePersonalStore((state) => state.bulkChange);
  const drafts = usePersonalStore((state) => state.drafts);
  const recurringError = useDueRecurring();
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
  const [bulkSheet, setBulkSheet] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkType, setBulkType] = useState<'category' | 'tags' | 'trash'>('category');
  const [bulkCategory, setBulkCategory] = useState('other');
  const [bulkTags, setBulkTags] = useState('');
  const [plan, setPlan] = useState<{ ids: string[]; action: BulkAction } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const categoryKeys = [...EXPENSE_CATEGORIES, ...categories.map((name) => `custom:${name}`)];
  function invalidatePlan() {
    setPlan(null);
    setConfirmation('');
  }
  function cancelSelection() {
    setSelecting(false);
    setBulkSheet(false);
    setSelected([]);
    invalidatePlan();
  }
  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
    invalidatePlan();
  }
  function clearFilters() {
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
    setSort('newest');
  }
  useEffect(() => {
    if (status === 'idle') void loadEntries();
  }, [status, loadEntries]);
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
        .map((code) =>
          formatMoney(periodReport(entries, localDate().slice(0, 7), code).spending, code),
        )
        .join(' · ');
    } catch (err) {
      return message(err);
    }
  }, [entries]);
  const activeFilters =
    [month, start, end, currency, type, category, accountId, tag, min, max]
      .concat(receipt)
      .filter(Boolean).length + (sort === 'newest' ? 0 : 1);
  const pending = drafts.filter((draft) => draft.status === 'pending').length;
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
  const visible = result.rows.slice(0, pageSize);
  const failure = error ?? result.error ?? storeError ?? recurringError;
  const showMore =
    result.rows.length > pageSize ? (
      <Button
        variant="ghost"
        label={`Show more (${result.rows.length - pageSize} remaining)`}
        onPress={() => setPageSize(pageSize + 50)}
      />
    ) : undefined;
  const listInset = BottomTabInset + (selecting ? 150 : 96);

  const header = (
    <View style={styles.listHeader}>
      {pending && !trash ? (
        <Banner
          tone="warning"
          message={`${pending} recurring ${pending === 1 ? 'draft needs' : 'drafts need'} approval`}
          actionLabel="Review"
          onAction={() => router.push('/recurring')}
        />
      ) : null}
      {failure ? <Failure message={failure} /> : null}
      {status === 'error' ? (
        <Action label="Retry loading transactions" onPress={() => void loadEntries()} />
      ) : null}
      {start || end ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Dates {start || '…'} to {end || '…'} (inclusive)
        </ThemedText>
      ) : null}
      {trash ? (
        <Banner
          tone="info"
          message="Deleted transactions stay here until restored. Swipe a row left to restore it."
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <Screen
        tabBar
        scroll={false}
        header={
          <>
            <ScreenHeader
              large
              title={trash ? 'Trash' : 'Activity'}
              subtitle={
                trash
                  ? 'Recover deleted transactions'
                  : `This month · ${summary || 'No spending yet'}`
              }
              right={
                <>
                  {!trash ? (
                    <IconButton
                      icon="select"
                      selected={selecting}
                      accessibilityLabel={
                        selecting ? 'Cancel bulk selection' : 'Select for bulk actions'
                      }
                      disabled={busy}
                      onPress={() => {
                        if (selecting) cancelSelection();
                        else setSelecting(true);
                      }}
                    />
                  ) : null}
                  <IconButton
                    icon="trash"
                    selected={trash}
                    accessibilityLabel={trash ? 'Show active' : 'Trash / restore'}
                    onPress={() => {
                      setTrash(!trash);
                      cancelSelection();
                    }}
                  />
                </>
              }
            />
            <View style={styles.searchRow}>
              <SearchBar
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPageSize(50);
                }}
                placeholder="Search transactions"
                accessibilityLabel="Search description, notes, tags"
              />
              <View>
                <IconButton
                  icon="filter"
                  selected={activeFilters > 0}
                  accessibilityLabel={
                    activeFilters ? `Search filters (${activeFilters} active)` : 'Search filters'
                  }
                  onPress={() => setFilters(true)}
                />
              </View>
            </View>
          </>
        }>
        {status === 'loading' && entries.length === 0 ? (
          <ThemedText themeColor="textSecondary">Loading transactions…</ThemedText>
        ) : selecting ? (
          <FlatList
            data={visible}
            keyExtractor={(entry) => entry.id}
            ListHeaderComponent={header}
            ListFooterComponent={showMore}
            contentContainerStyle={{ paddingBottom: listInset }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.one }} />}
            ListEmptyComponent={
              <EmptyState title="No matching transactions" message="Try clearing your filters." />
            }
            renderItem={({ item }) => (
              <TransactionRow
                expense={item}
                role="checkbox"
                checked={selected.includes(item.id)}
                disabled={busy}
                accessibilityLabel={`Select ${item.description}, ${item.date}`}
                onPress={() => toggleSelected(item.id)}
              />
            )}
          />
        ) : (
          <ExpenseList
            expenses={visible}
            header={header}
            footer={showMore}
            bottomInset={listInset}
            onDelete={(id) => void mutate(id)}
            onSelect={(id) => router.push({ pathname: '/expenses/[id]', params: { id } })}
          />
        )}
      </Screen>

      {selecting ? (
        <View
          style={[
            styles.bulkBar,
            { backgroundColor: theme.card, borderColor: theme.border, bottom: BottomTabInset },
          ]}>
          <ThemedText type="smallBold" style={styles.bulkCount}>
            {selected.length} selected
          </ThemedText>
          <Button
            variant="ghost"
            label={`Select page (${Math.min(pageSize, result.rows.length)})`}
            disabled={busy}
            onPress={() => {
              setSelected((current) => [
                ...new Set([...current, ...visible.map((entry) => entry.id)]),
              ]);
              invalidatePlan();
            }}
          />
          <Button
            label="Bulk change"
            accessibilityLabel={`Bulk change ${selected.length} selected`}
            disabled={busy || !selected.length}
            onPress={() => setBulkSheet(true)}
          />
        </View>
      ) : !trash ? (
        <Fab label="Add" onPress={() => router.push('/add-expense')} />
      ) : null}

      <Sheet
        visible={filters}
        title="Filters"
        onClose={() => setFilters(false)}
        footer={
          <View style={styles.sheetActions}>
            <Button
              variant="secondary"
              label="Clear filters"
              onPress={clearFilters}
              style={styles.flex}
            />
            <Button
              label={`Show ${result.rows.length} results`}
              onPress={() => setFilters(false)}
              style={styles.flex}
            />
          </View>
        }>
        <SectionHeader title="Type" />
        <ChipGroup
          scroll
          value={type}
          onChange={setType}
          options={['', 'expense', 'income', 'refund', 'transfer'].map((value) => ({
            value,
            label: value ? value[0]!.toUpperCase() + value.slice(1) : 'All',
          }))}
        />
        <SectionHeader title="Category" />
        <ChipGroup
          scroll
          value={category}
          onChange={setCategory}
          options={[
            { value: '', label: 'All' },
            ...categoryKeys.map((value) => ({ value, label: categoryLabel(value) })),
          ]}
        />
        {accounts.length ? (
          <>
            <SectionHeader title="Account" />
            <ChipGroup
              scroll
              value={accountId}
              onChange={setAccountId}
              options={[
                { value: '', label: 'All accounts' },
                ...accounts.map((account) => ({ value: account.id, label: account.name })),
              ]}
            />
          </>
        ) : null}
        <SectionHeader title="Dates" />
        <Field label="Month" placeholder="YYYY-MM" value={month} onChange={setMonth} />
        <View style={styles.pair}>
          <View style={styles.flex}>
            <Field label="From" placeholder="YYYY-MM-DD" value={start} onChange={setStart} />
          </View>
          <View style={styles.flex}>
            <Field label="Through" placeholder="YYYY-MM-DD" value={end} onChange={setEnd} />
          </View>
        </View>
        <SectionHeader title="Amount" />
        <Field
          label="Currency"
          placeholder="e.g. INR"
          value={currency}
          onChange={(value) => setCurrency(value.toUpperCase())}
        />
        <View style={styles.pair}>
          <View style={styles.flex}>
            <Field label="Minimum" keyboardType="decimal-pad" value={min} onChange={setMin} />
          </View>
          <View style={styles.flex}>
            <Field label="Maximum" keyboardType="decimal-pad" value={max} onChange={setMax} />
          </View>
        </View>
        <SectionHeader title="More" />
        <Field label="Exact tag" value={tag} onChange={setTag} />
        <ChipGroup
          value={receipt}
          onChange={setReceipt}
          options={[
            { value: '', label: 'Any receipt' },
            { value: 'yes', label: 'Has receipt' },
            { value: 'no', label: 'No receipt' },
          ]}
        />
        <SectionHeader title="Sort by" />
        <ChipGroup
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'amount', label: 'Amount' },
          ]}
        />
        {sort === 'amount' && !currency ? (
          <ThemedText type="caption" themeColor="textSecondary">
            Choose one currency to sort by amount.
          </ThemedText>
        ) : null}
        {result.error ? <Failure message={result.error} /> : null}
      </Sheet>

      <Sheet visible={bulkSheet} title="Bulk changes" onClose={() => setBulkSheet(false)}>
        <ThemedText type="smallBold">
          {selected.length} explicitly selected across filters
        </ThemedText>
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
            values={categoryKeys.map((value) => ({ value, label: categoryLabel(value) }))}
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
        <ThemedText type="caption" themeColor="textSecondary">
          Tags are added without removing existing tags. Category changes must include linked
          refunds where needed; trashing an original requires selecting its active refunds too. All
          selected changes commit together or none do.
        </ThemedText>
        {error ? <Failure message={error} /> : null}
        <Action
          label={`Review ${selected.length} selected changes`}
          disabled={busy || !selected.length}
          onPress={reviewBulk}
        />
        {plan ? (
          <Card>
            <ThemedText type="smallBold">
              Confirm{' '}
              {plan.action.type === 'category'
                ? `category → ${categoryLabel(plan.action.category)}`
                : plan.action.type === 'tags'
                  ? `add tags: ${plan.action.tags}`
                  : 'move to recoverable trash'}
            </ThemedText>
            {plan.ids.map((id) => (
              <ThemedText key={id} type="small" themeColor="textSecondary">
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
              variant="primary"
              label="Apply confirmed bulk changes"
              disabled={busy || confirmation !== `APPLY ${plan.ids.length}`}
              onPress={() => void applyBulk()}
            />
          </Card>
        ) : null}
        <Action
          label="Clear all selections"
          disabled={busy}
          onPress={() => {
            setSelected([]);
            invalidatePlan();
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  listHeader: { gap: Spacing.two },
  pair: { flexDirection: 'row', gap: Spacing.two },
  sheetActions: { flexDirection: 'row', gap: Spacing.two },
  bulkBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    marginBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    paddingLeft: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 6,
    shadowColor: '#101828',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  bulkCount: { flex: 1 },
});
