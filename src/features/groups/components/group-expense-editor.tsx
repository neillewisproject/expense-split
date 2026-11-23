import { router, useLocalSearchParams } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import {
  amountToInput,
  formatMoney,
  getCurrencyExponent,
  parseAmount,
} from '@/features/expenses/domain/money';
import { calculateItemizedBill, type BillItem } from '@/features/expenses/domain/itemized';
import { convertGroupAllocation } from '../domain/conversion';
import { ReceiptPicker } from '@/features/receipts/components/receipt-picker';
import { useGroupsStore } from '../store';
import type { GroupExpense, GroupWithDetails, SplitInputs, SplitMode } from '../domain/group';
import { calculateSavedSplit } from '../domain/split-inputs';
import { canEditExpense, validateGroupExpense } from '../domain/validation';
import { GroupButton, GroupError, GroupField, GroupPage } from './group-controls';

export function GroupExpenseEditor({ settlement = false }: { settlement?: boolean }) {
  const { id, expenseId, from, to, amount } = useLocalSearchParams<{
    id: string;
    expenseId?: string;
    from?: string;
    to?: string;
    amount?: string;
  }>();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === id));
  if (!group)
    return (
      <GroupPage>
        <ThemedText>Group not found. Reload groups.</ThemedText>
        <GroupButton label="Back" onPress={() => router.back()} />
      </GroupPage>
    );
  const existing = group.expenses.find((expense) => expense.id === expenseId);
  if (existing?.kind === 'refund')
    return (
      <GroupPage>
        <GroupButton label="Back" onPress={() => router.back()} />
        <ThemedText>Refunds use linked original allocations, not a new split or rate.</ThemedText>
        <GroupButton
          label="Open linked refund"
          onPress={() =>
            router.replace({
              pathname: '/groups/[id]/refund',
              params: { id, originalId: existing.refundOfId ?? '', refundId: existing.id },
            })
          }
        />
      </GroupPage>
    );
  if (expenseId && !existing)
    return (
      <GroupPage>
        <ThemedText>Entry not found.</ThemedText>
      </GroupPage>
    );
  return (
    <Editor
      key={`${id}:${expenseId ?? 'new'}`}
      group={group}
      existing={existing}
      settlement={existing ? existing.kind === 'settlement' : settlement}
      preset={{ from, to, amount }}
    />
  );
}

function Editor({
  group,
  existing,
  settlement,
  preset,
}: {
  group: GroupWithDetails;
  existing?: GroupExpense;
  settlement: boolean;
  preset: { from?: string; to?: string; amount?: string };
}) {
  const userId = useGroupsStore((state) => state.activeUserId);
  const sourceCurrency = existing?.conversion?.originalCurrency ?? group.currency;
  const savedInputs = existing?.conversion?.splitInputs ?? existing?.splitInputs;
  const savedItemized = existing?.conversion?.itemized ?? existing?.itemized;
  const [currency, setCurrency] = useState(sourceCurrency);
  const [rate, setRate] = useState(existing?.conversion?.rate ?? '1');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(
    existing
      ? amountToInput(existing.conversion?.originalAmount ?? existing.amount, sourceCurrency)
      : (preset.amount ?? ''),
  );
  const [date, setDate] = useState(
    existing?.date ??
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      })(),
  );
  const [category, setCategory] = useState(existing?.category ?? 'other');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [method, setMethod] = useState(existing?.method ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [receipts, setReceipts] = useState(existing?.receipts ?? []);
  const [mode, setMode] = useState<SplitMode>(
    savedInputs?.mode ?? (existing && !settlement ? 'exact' : 'equally'),
  );
  const [selected, setSelected] = useState<string[]>(
    savedInputs?.memberIds ??
      (existing
        ? Object.keys(existing.split)
        : group.members.filter((member) => !member.deactivatedAt).map((member) => member.id)),
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(
        savedInputs?.values ??
          (existing ? (existing.conversion?.originalSplit ?? existing.split) : {}),
      ).map(([id, value]) => [
        id,
        mode === 'exact' || mode === 'adjustments'
          ? amountToInput(value, sourceCurrency)
          : String(value),
      ]),
    ),
  );
  const [payer, setPayer] = useState(
    existing?.paidBy ??
      preset.from ??
      group.members.find((member) => !member.deactivatedAt)?.id ??
      '',
  );
  const [recipient, setRecipient] = useState(
    existing ? (Object.keys(existing.split)[0] ?? '') : (preset.to ?? ''),
  );
  const [multiPayer, setMultiPayer] = useState(
    existing
      ? Object.values(existing.conversion?.originalContributions ?? existing.contributions).filter(
          (value) => value > 0,
        ).length > 1
      : false,
  );
  const [contributions, setContributions] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(
        existing?.conversion?.originalContributions ?? existing?.contributions ?? {},
      ).map(([id, value]) => [id, amountToInput(value, sourceCurrency)]),
    ),
  );
  const [items, setItems] = useState<BillItem[]>(savedItemized?.items ?? []);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemMembers, setItemMembers] = useState<string[]>([]);
  const [discount, setDiscount] = useState(
    amountToInput(savedItemized?.adjustments.discount ?? 0, sourceCurrency),
  );
  const [tax, setTax] = useState(
    amountToInput(savedItemized?.adjustments.tax ?? 0, sourceCurrency),
  );
  const [tip, setTip] = useState(
    amountToInput(savedItemized?.adjustments.tip ?? 0, sourceCurrency),
  );
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const submissionId = useRef<string | null>(null);
  const enabled =
    !group.archivedAt &&
    group.syncStatus !== 'conflict' &&
    (!existing || (!existing.deletedAt && canEditExpense(group, existing, userId)));
  const members = group.members.filter((member) => !member.deactivatedAt || existing || settlement);
  let displayCurrency = sourceCurrency;
  try {
    getCurrencyExponent(currency);
    displayCurrency = currency;
  } catch {
    // Partial ISO-code input must not crash rendering while the user is typing.
  }

  function monetary(text: string): number {
    const value = parseAmount(text.trim() || '0', currency);
    if (value === null) throw new Error(`Enter valid ${currency} amounts.`);
    return value;
  }

  function buildInput() {
    const total = monetary(amount);
    const inputs: SplitInputs = { mode, memberIds: selected, values: {} };
    if (mode !== 'equally' && mode !== 'itemized') {
      inputs.values = Object.fromEntries(
        selected.map((id) => {
          const text = values[id] ?? (mode === 'shares' ? '1' : '0');
          const value =
            mode === 'adjustments' && text.trim().startsWith('-')
              ? -monetary(text.trim().slice(1))
              : mode === 'exact' || mode === 'adjustments'
                ? monetary(text)
                : Number(text || 0);
          if (!Number.isFinite(value)) throw new Error('Split values must be finite numbers.');
          return [id, value];
        }),
      );
    }
    const itemized =
      mode === 'itemized' && !settlement
        ? {
            items,
            adjustments: { discount: monetary(discount), tax: monetary(tax), tip: monetary(tip) },
          }
        : null;
    const allocation = settlement
      ? { [recipient]: total }
      : calculateSavedSplit(total, inputs, itemized);
    const paid =
      multiPayer && !settlement
        ? Object.fromEntries(
            members.map((member) => [member.id, monetary(contributions[member.id] ?? '0')]),
          )
        : { [payer]: total };
    const foreign = currency !== group.currency;
    const baseSplit = foreign
      ? convertGroupAllocation(total, allocation, currency, group.currency, rate)
      : { total, parts: allocation };
    const basePaid = foreign
      ? convertGroupAllocation(total, paid, currency, group.currency, rate)
      : { total, parts: paid };
    const paidBy = Object.entries(basePaid.parts).find(([, value]) => value > 0)?.[0] ?? payer;
    const input = {
      description:
        description.trim() ||
        (settlement
          ? `Settlement: ${group.members.find((member) => member.id === payer)?.name ?? 'Sender'} paid ${group.members.find((member) => member.id === recipient)?.name ?? 'recipient'}`
          : ''),
      amount: baseSplit.total,
      paidBy,
      split: baseSplit.parts,
      contributions: basePaid.parts,
      date,
      kind: settlement ? ('settlement' as const) : (existing?.kind ?? ('expense' as const)),
      splitInputs: settlement || foreign ? null : inputs,
      itemized: foreign ? null : itemized,
      conversion: foreign
        ? {
            originalAmount: total,
            originalCurrency: currency,
            rate,
            originalExponent: getCurrencyExponent(currency),
            baseExponent: getCurrencyExponent(group.currency),
            originalSplit: allocation,
            originalContributions: paid,
            splitInputs: settlement ? null : inputs,
            itemized,
          }
        : null,
      category,
      notes,
      method,
      reference,
      receipts,
    };
    const now = new Date().toISOString();
    validateGroupExpense(group, {
      ...input,
      id: existing?.id ?? 'preview',
      currency: group.currency,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      authorId: existing?.authorId ?? userId,
      revision: (existing?.revision ?? 0) + 1,
      deletedAt: existing?.deletedAt ?? null,
    });
    return input;
  }

  async function save() {
    if (busy || !enabled) return;
    setError(null);
    setBusy(true);
    try {
      const input = buildInput();
      if (existing) await useGroupsStore.getState().editGroupExpense(group.id, existing.id, input);
      else {
        submissionId.current ??= randomUUID();
        await useGroupsStore.getState().addGroupExpense(group.id, input, submissionId.current);
      }
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save entry.');
    } finally {
      setBusy(false);
    }
  }

  function addItem() {
    try {
      const item: BillItem = {
        id: randomUUID(),
        description: itemName.trim(),
        quantity: Number(itemQuantity),
        unitAmount: monetary(itemPrice),
        shares: Object.fromEntries(itemMembers.map((id) => [id, 1])),
      };
      calculateItemizedBill([item], { discount: 0, tax: 0, tip: 0 }, selected);
      setItems((current) => [...current, item]);
      setItemName('');
      setItemPrice('');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invalid bill item.');
    }
  }

  return (
    <GroupPage>
      <GroupButton label="Cancel" onPress={() => router.back()} />
      {existing && group.expenses.some((entry) => entry.refundOfId === existing.id) ? (
        <ThemedText>
          Refund history locks this original expense’s amount, currency, rate, payer and owed
          allocations, even after refunds are voided. Keep financial inputs unchanged; description,
          category, notes and dates can still be corrected.
        </ThemedText>
      ) : null}
      <ThemedText type="subtitle">
        {existing ? 'Edit' : 'Add'} {settlement ? 'settlement' : 'group expense'}
      </ThemedText>
      {!enabled ? (
        <ThemedText>
          Archived, deleted, conflicting, or read-only entry. Only its author or owner may edit.
        </ThemedText>
      ) : null}
      <GroupField label="Description" value={description} onChange={setDescription} />
      <GroupField
        label="Original currency (ISO code)"
        value={currency}
        onChange={(value) => setCurrency(value.trim().toUpperCase())}
      />
      <ThemedText>
        Changing currency reinterprets entered amounts; review prices and allocations before saving.
      </ThemedText>
      <GroupField label={`Amount (${currency})`} value={amount} onChange={setAmount} numeric />
      {currency !== group.currency ? (
        <>
          <GroupField
            label={`Fixed rate: 1 ${currency} = ? ${group.currency}`}
            value={rate}
            onChange={setRate}
            numeric
          />
          <ThemedText>
            Manual historical rate. Original inputs are retained; balances always use{' '}
            {group.currency}.
          </ThemedText>
        </>
      ) : null}
      <GroupField label="Date (YYYY-MM-DD)" value={date} onChange={setDate} />
      <ThemedText type="smallBold">{settlement ? 'Sender' : 'Payer'}</ThemedText>
      {members.map((member) => (
        <GroupButton
          key={member.id}
          label={member.name}
          selected={payer === member.id}
          onPress={() => setPayer(member.id)}
        />
      ))}
      {settlement ? (
        <>
          <ThemedText type="smallBold">Recipient</ThemedText>
          {members.map((member) => (
            <GroupButton
              key={member.id}
              label={member.name}
              selected={recipient === member.id}
              onPress={() => setRecipient(member.id)}
            />
          ))}
          <ThemedText>
            Partial and custom amounts are allowed. Recording does not execute a payment.
          </ThemedText>
          <GroupField label="Payment method" value={method} onChange={setMethod} />
          <GroupField label="Payment reference" value={reference} onChange={setReference} />
        </>
      ) : (
        <>
          <GroupButton
            label="Multiple payers"
            selected={multiPayer}
            onPress={() => setMultiPayer(!multiPayer)}
          />
          {multiPayer
            ? members.map((member) => (
                <GroupField
                  key={member.id}
                  label={`${member.name} paid (${currency})`}
                  numeric
                  value={contributions[member.id] ?? '0'}
                  onChange={(text) =>
                    setContributions((current) => ({ ...current, [member.id]: text }))
                  }
                />
              ))
            : null}
          <ThemedText type="smallBold">Split mode</ThemedText>
          {(['equally', 'exact', 'percentages', 'shares', 'adjustments', 'itemized'] as const).map(
            (value) => (
              <GroupButton
                key={value}
                label={value}
                selected={mode === value}
                onPress={() => {
                  setMode(value);
                  setValues({});
                }}
              />
            ),
          )}
          <ThemedText>Select who owes a share. Excluded participants may still pay.</ThemedText>
          {members.map((member) => (
            <View key={member.id} style={{ gap: 8 }}>
              <GroupButton
                label={member.name}
                selected={selected.includes(member.id)}
                onPress={() =>
                  setSelected((current) =>
                    current.includes(member.id)
                      ? current.filter((id) => id !== member.id)
                      : [...current, member.id],
                  )
                }
              />
              {selected.includes(member.id) && mode !== 'equally' && mode !== 'itemized' ? (
                <GroupField
                  label={`${member.name} ${mode}`}
                  numeric
                  value={values[member.id] ?? (mode === 'shares' ? '1' : '0')}
                  onChange={(text) => setValues((current) => ({ ...current, [member.id]: text }))}
                />
              ) : null}
            </View>
          ))}
          {mode === 'itemized' ? (
            <>
              <ThemedText>
                Manual bill items. Shared discounts, tax and tip are allocated once, proportionally
                to consumed items.
              </ThemedText>
              {items.map((item) => (
                <View key={item.id}>
                  <ThemedText>
                    {item.description} × {item.quantity} ·{' '}
                    {formatMoney(item.unitAmount, displayCurrency)}
                  </ThemedText>
                  <GroupButton
                    label={`Remove ${item.description}`}
                    onPress={() =>
                      setItems((current) => current.filter((entry) => entry.id !== item.id))
                    }
                  />
                </View>
              ))}
              <GroupField label="Item description" value={itemName} onChange={setItemName} />
              <GroupField
                label="Item unit price"
                value={itemPrice}
                onChange={setItemPrice}
                numeric
              />
              <GroupField
                label="Item quantity"
                value={itemQuantity}
                onChange={setItemQuantity}
                numeric
              />
              {members
                .filter((member) => selected.includes(member.id))
                .map((member) => (
                  <GroupButton
                    key={member.id}
                    label={`Item shared by ${member.name}`}
                    selected={itemMembers.includes(member.id)}
                    onPress={() =>
                      setItemMembers((current) =>
                        current.includes(member.id)
                          ? current.filter((id) => id !== member.id)
                          : [...current, member.id],
                      )
                    }
                  />
                ))}
              <GroupButton label="Add item" onPress={addItem} />
              <GroupField label="Discount" value={discount} onChange={setDiscount} numeric />
              <GroupField label="Tax/service charge" value={tax} onChange={setTax} numeric />
              <GroupField label="Tip" value={tip} onChange={setTip} numeric />
              <GroupButton
                label="Calculate bill total"
                onPress={() => {
                  try {
                    const result = calculateItemizedBill(
                      items,
                      { discount: monetary(discount), tax: monetary(tax), tip: monetary(tip) },
                      selected,
                    );
                    setAmount(amountToInput(result.total, currency));
                    setError(null);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Invalid bill.');
                  }
                }}
              />
            </>
          ) : null}
          <GroupField label="Category" value={category} onChange={setCategory} />
        </>
      )}
      <GroupField label="Notes" value={notes} onChange={setNotes} multiline />
      <ReceiptPicker uris={receipts} onChange={setReceipts} />
      {existing && userId && group.syncUserId === userId ? (
        <GroupButton
          label="Shared receipts (explicit upload)"
          onPress={() =>
            router.push({
              pathname: '/shared-receipts',
              params: { groupId: group.id, expenseId: existing.id },
            })
          }
        />
      ) : null}
      <GroupButton
        label="Preview paid / owed"
        onPress={() => {
          try {
            const input = buildInput();
            setPreview(
              group.members
                .map(
                  (member) =>
                    `${member.name}: paid ${formatMoney(input.contributions[member.id] ?? 0, group.currency)}, owes ${formatMoney(input.split[member.id] ?? 0, group.currency)}`,
                )
                .join('\n'),
            );
            setError(null);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Invalid split.');
          }
        }}
      />
      {preview ? <ThemedText>{preview}</ThemedText> : null}
      <GroupError error={error} />
      <GroupButton
        label={busy ? 'Saving…' : 'Save entry'}
        disabled={busy || !enabled}
        onPress={() => void save()}
      />
      {existing ? (
        <>
          <ThemedText type="smallBold">Comments and entry history</ThemedText>
          {group.activity
            .filter((event) => event.expenseId === existing.id)
            .map((event) => (
              <View key={event.id}>
                <ThemedText>
                  {event.action} · {new Date(event.createdAt).toLocaleString()} ·{' '}
                  {event.actorId ?? 'local user'}
                </ThemedText>
                {event.text ? <ThemedText>{event.text}</ThemedText> : null}
                {event.details ? <ThemedText type="small">{event.details}</ThemedText> : null}
              </View>
            ))}
          <GroupField label="Add comment" value={comment} onChange={setComment} multiline />
          <GroupButton
            label="Post comment"
            disabled={busy || !!group.archivedAt || group.syncStatus === 'conflict'}
            onPress={() =>
              void (async () => {
                if (busy) return;
                setBusy(true);
                try {
                  await useGroupsStore.getState().addComment(group.id, existing.id, comment);
                  setComment('');
                  setError(null);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Could not add comment.');
                } finally {
                  setBusy(false);
                }
              })()
            }
          />
        </>
      ) : null}
    </GroupPage>
  );
}
