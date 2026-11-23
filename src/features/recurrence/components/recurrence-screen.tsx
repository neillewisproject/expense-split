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
import { localDate } from '@/features/expenses/domain/expense';
import { formatMoney } from '@/features/expenses/domain/money';
import { useExpensesStore } from '@/features/expenses/store';
import type { RecurringRule } from '../data/schema';
import {
  addPersonalReminder,
  readPersonalReminders,
  removePersonalReminder,
} from '../data/reminder-state';

export function RecurrenceScreen() {
  const rules = usePersonalStore((state) => state.rules);
  const drafts = usePersonalStore((state) => state.drafts);
  const generate = usePersonalStore((state) => state.generateDue);
  const add = usePersonalStore((state) => state.addRule);
  const decide = usePersonalStore((state) => state.decideDraft);
  const setActive = usePersonalStore((state) => state.setRuleActive);
  const entries = useExpensesStore((state) => state.expenses);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const storeError = usePersonalStore((state) => state.error);
  const [entryId, setEntryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringRule['frequency']>('monthly');
  const [interval, setInterval] = useState('1');
  const [start, setStart] = useState(localDate());
  const [end, setEnd] = useState('');
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reminderTime, setReminderTime] = useState(`${localDate()} 09:00`);
  const [reminders, setReminders] = useState<Awaited<ReturnType<typeof readPersonalReminders>>>({});
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setReminders(await readPersonalReminders());
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void generate().catch((err: unknown) => setError(message(err)));
    void loadEntries();
  }, [generate, loadEntries]);
  useEffect(() => {
    void readPersonalReminders()
      .then(setReminders)
      .catch((err: unknown) => setError(message(err)));
  }, []);
  return (
    <PersonalPage title="Recurring approval drafts">
      <ThemedText>
        Due entries are proposed on app resume, never posted automatically. New schedules use their
        selected time zone; older schedules without one use the current device calendar. End dates
        are inclusive. Month-end schedules retain the original day (Jan 31 → Feb 28 → Mar 31). A
        pass processes at most 100 occurrences per rule; review then check again for older backlog.
        No background alarms.
      </ThemedText>
      <Failure message={error ?? storeError} />
      <Action label="Check due entries" disabled={busy} onPress={() => void run(generate)} />
      <Field
        label="One-off reminder time (YYYY-MM-DD HH:mm, device local)"
        value={reminderTime}
        onChange={setReminderTime}
      />
      <ThemedText>
        Reminders are explicit device-local one-off notifications, with generic private content.
        They do not post entries and are not restored from backups. Permission is requested only
        when scheduling.
      </ThemedText>
      {drafts
        .filter((draft) => draft.status === 'pending')
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((draft) => {
          const template = JSON.parse(draft.template) as {
            description: string;
            amount: number;
            currency?: string;
          };
          return (
            <ThemedText key={draft.id}>
              {draft.date} · {template.description} ·{' '}
              {formatMoney(template.amount, template.currency ?? 'INR')}
              {'\n'}
              <ThemedText
                type="linkPrimary"
                onPress={() => {
                  if (!busy) void run(() => decide(draft.id, true));
                }}>
                Approve
              </ThemedText>
              {' · '}
              <ThemedText
                type="linkPrimary"
                onPress={() => {
                  if (!busy) void run(() => decide(draft.id, false));
                }}>
                Skip
              </ThemedText>
            </ThemedText>
          );
        })}
      {rules.map((rule) => (
        <ThemedText key={rule.id}>
          {rule.name} · every {rule.interval} {rule.frequency} ·{' '}
          {rule.endDate && rule.nextDate > rule.endDate
            ? 'schedule ended'
            : `next ${rule.nextDate}`}
          {rule.endDate ? ` · ends ${rule.endDate}` : ''}
          {` · ${rule.timeZone ?? 'device time zone'}`}
          {'\n'}
          <ThemedText
            type="linkPrimary"
            onPress={() => {
              if (!busy)
                void run(async () => {
                  if (rule.active) await removePersonalReminder(rule.id);
                  await setActive(rule.id, !rule.active);
                });
            }}>
            {rule.active ? 'Pause' : 'Resume'}
          </ThemedText>
          {' · '}
          <ThemedText
            type="linkPrimary"
            onPress={() => {
              if (!busy)
                void run(async () => {
                  if (reminders[rule.id]) await removePersonalReminder(rule.id);
                  else {
                    if (!rule.active)
                      throw new Error('Resume the schedule before adding a reminder');
                    if (!/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d$/.test(reminderTime))
                      throw new Error('Use YYYY-MM-DD HH:mm');
                    const when = new Date(`${reminderTime.replace(' ', 'T')}:00`);
                    if (localDate(when) !== reminderTime.slice(0, 10))
                      throw new Error('Enter a valid calendar date');
                    await addPersonalReminder(rule.id, when);
                  }
                });
            }}>
            {reminders[rule.id]
              ? `Cancel reminder (${new Date(reminders[rule.id]!.date).toLocaleString()})`
              : 'Schedule one-off reminder'}
          </ThemedText>
        </ThemedText>
      ))}
      <ThemedText type="smallBold">Create from an existing transaction</ThemedText>
      <Choices
        value={entryId}
        onChange={setEntryId}
        values={entries
          .filter((entry) => !entry.deletedAt && entry.entryType !== 'refund')
          .map((entry) => ({ value: entry.id, label: `${entry.date} · ${entry.description}` }))}
      />
      <Choices
        value={frequency}
        onChange={(value) => setFrequency(value as RecurringRule['frequency'])}
        values={['daily', 'weekly', 'monthly', 'yearly'].map((value) => ({ value, label: value }))}
      />
      <Field label="Interval" value={interval} onChange={setInterval} />
      <Field label="First due date (YYYY-MM-DD)" value={start} onChange={setStart} />
      <Field label="Last due date (optional, YYYY-MM-DD)" value={end} onChange={setEnd} />
      <Field label="IANA time zone (e.g. Asia/Kolkata)" value={timeZone} onChange={setTimeZone} />
      <Action
        label="Create schedule"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const entry = entries.find((item) => item.id === entryId);
            if (!entry) throw new Error('Choose a transaction to repeat');
            await add(
              entry,
              frequency,
              start,
              Number(interval),
              end.trim() || null,
              timeZone.trim(),
            );
            await generate();
          })
        }
      />
    </PersonalPage>
  );
}
