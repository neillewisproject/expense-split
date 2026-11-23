import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconBadge, type IconName } from '@/components/ui';
import { Spacing } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: IconName;
};

export function EmptyState({ title, message, icon = 'activity' }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <IconBadge icon={icon} size={56} />
      <ThemedText type="heading">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
  message: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
