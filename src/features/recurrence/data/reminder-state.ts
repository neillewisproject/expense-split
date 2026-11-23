import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelLocalReminder, scheduleLocalReminder } from '../local-reminders';

const key = 'expense-split:personal-reminders:v1';
type Reminder = { id: string; date: string };
let pending: Promise<unknown> = Promise.resolve();
function mutate<T>(work: () => Promise<T>): Promise<T> {
  const result = pending.then(work);
  pending = result.catch(() => undefined);
  return result;
}
export async function readPersonalReminders(): Promise<Record<string, Reminder>> {
  const saved = await AsyncStorage.getItem(key);
  return saved ? (JSON.parse(saved) as Record<string, Reminder>) : {};
}
export function addPersonalReminder(ruleId: string, date: Date): Promise<void> {
  return mutate(async () => {
    const reminders = await readPersonalReminders();
    if (reminders[ruleId])
      throw new Error('Cancel the existing reminder before scheduling another');
    const id = await scheduleLocalReminder(
      'Expense review reminder',
      'Open Expense Split to review your due drafts.',
      date,
    );
    try {
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ ...reminders, [ruleId]: { id, date: date.toISOString() } }),
      );
    } catch (error) {
      await cancelLocalReminder(id);
      throw error;
    }
  });
}
export function removePersonalReminder(ruleId: string): Promise<void> {
  return mutate(async () => {
    const reminders = await readPersonalReminders();
    const reminder = reminders[ruleId];
    if (!reminder) return;
    await cancelLocalReminder(reminder.id);
    delete reminders[ruleId];
    await AsyncStorage.setItem(key, JSON.stringify(reminders));
  });
}
export function cancelAllPersonalReminders(): Promise<void> {
  return mutate(async () => {
    const reminders = await readPersonalReminders();
    for (const reminder of Object.values(reminders)) await cancelLocalReminder(reminder.id);
    await AsyncStorage.removeItem(key);
  });
}
