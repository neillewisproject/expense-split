import * as Haptics from 'expo-haptics';

export function triggerSuccessHaptic(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
    (error: unknown) => {
      console.warn('Could not trigger success haptic feedback.', error);
    },
  );
}
