import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  message: {
    textAlign: 'center',
  },
});
