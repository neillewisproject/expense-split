import { Platform } from 'react-native';

export async function scheduleLocalReminder(
  title: string,
  body: string,
  date: Date,
): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Device reminders are available on Android and iOS');
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
    throw new Error('Choose a future reminder time');
  }
  const notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync('expense-reminders', {
      name: 'Expense reminders',
      importance: notifications.AndroidImportance.DEFAULT,
    });
  }
  const permissions = await notifications.requestPermissionsAsync();
  if (!permissions.granted)
    throw new Error('Notification permission was denied. Enable it in device settings.');
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  return notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
      date,
      channelId: 'expense-reminders',
    },
  });
}

export async function cancelLocalReminder(id: string): Promise<void> {
  const notifications = await import('expo-notifications');
  await notifications.cancelScheduledNotificationAsync(id);
}
