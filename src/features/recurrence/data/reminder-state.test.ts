import AsyncStorage from '@react-native-async-storage/async-storage';
import { cancelLocalReminder, scheduleLocalReminder } from '../local-reminders';
import { addPersonalReminder, removePersonalReminder } from './reminder-state';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('../local-reminders', () => ({
  scheduleLocalReminder: jest.fn(),
  cancelLocalReminder: jest.fn(),
}));
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  jest.mocked(AsyncStorage.setItem).mockResolvedValue();
  jest.mocked(scheduleLocalReminder).mockResolvedValue('native-1');
  jest.mocked(cancelLocalReminder).mockResolvedValue();
});
it('persists notification identifiers only after successful explicit scheduling', async () => {
  const date = new Date('2030-01-01T09:00:00.000Z');
  await addPersonalReminder('rent', date);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    expect.any(String),
    JSON.stringify({ rent: { id: 'native-1', date: date.toISOString() } }),
  );
  expect(scheduleLocalReminder).toHaveBeenCalledWith(
    'Expense review reminder',
    expect.any(String),
    date,
  );
});
it('cleans up a scheduled notification if identifier persistence fails', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage failed'));
  await expect(addPersonalReminder('rent', new Date('2030-01-01T09:00:00Z'))).rejects.toThrow(
    'storage failed',
  );
  expect(cancelLocalReminder).toHaveBeenCalledWith('native-1');
});
it('cancels and removes the stored reminder without requesting notification permission again', async () => {
  jest
    .mocked(AsyncStorage.getItem)
    .mockResolvedValue(
      JSON.stringify({ rent: { id: 'native-1', date: '2030-01-01T09:00:00.000Z' } }),
    );
  await removePersonalReminder('rent');
  expect(cancelLocalReminder).toHaveBeenCalledWith('native-1');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.any(String), '{}');
  expect(scheduleLocalReminder).not.toHaveBeenCalled();
});
