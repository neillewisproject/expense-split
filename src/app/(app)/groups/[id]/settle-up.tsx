import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { computeBalances, simplifyDebts } from '@/features/expenses/domain/balances';
import { formatMoney } from '@/features/expenses/domain/money';
import { useGroupsStore } from '@/features/groups/store';
import { useAuth } from '@/features/auth/auth-provider';
import { triggerSuccessHaptic } from '@/lib/success-haptics';

function getTodayDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function SettleUpScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === id));
  const status = useGroupsStore((state) => state.status);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const addGroupExpense = useGroupsStore((state) => state.addGroupExpense);
  const [savingSettlement, setSavingSettlement] = useState<string | null>(null);

  useEffect(() => {
    if (!group && status === 'idle') void loadGroups(user?.id);
  }, [group, loadGroups, status, user?.id]);

  if (!group) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">
            {status === 'idle' || status === 'loading' ? 'Loading group…' : 'Group not found'}
          </ThemedText>
          {status === 'ready' || status === 'error' ? (
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <ThemedText type="linkPrimary">Go back</ThemedText>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </ThemedView>
    );
  }

  const memberNames = new Map(group.members.map((member) => [member.id, member.name]));
  const settlements = simplifyDebts(computeBalances(group.expenses));

  async function recordSettlement(from: string, to: string, amount: number) {
    setSavingSettlement(`${from}:${to}`);
    try {
      await addGroupExpense(id, {
        description: `Settlement: ${memberNames.get(from)} paid ${memberNames.get(to)}`,
        amount,
        paidBy: from,
        split: { [to]: amount },
        date: getTodayDate(),
        kind: 'settlement',
      });
      triggerSuccessHaptic();
      router.back();
    } catch (error) {
      Alert.alert(
        'Could not record settlement',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSavingSettlement(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Settle up · {group.name}</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        <ThemedText themeColor="textSecondary">
          Recording a settlement updates the group balances and activity.
        </ThemedText>
        <FlatList
          data={settlements}
          keyExtractor={(settlement) => `${settlement.from}:${settlement.to}`}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              title="Everyone is settled"
              message="There are no payments to record right now."
            />
          }
          renderItem={({ item }) => {
            const key = `${item.from}:${item.to}`;
            const fromName = memberNames.get(item.from) ?? 'Unknown member';
            const toName = memberNames.get(item.to) ?? 'Unknown member';
            const isSaving = savingSettlement === key;
            return (
              <ThemedView type="backgroundElement" style={styles.settlementCard}>
                <View style={styles.settlementDescription}>
                  <ThemedText type="smallBold">
                    {fromName} pays {toName}
                  </ThemedText>
                  <ThemedText type="subtitle">{formatMoney(item.amount)}</ThemedText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={savingSettlement !== null}
                  onPress={() => void recordSettlement(item.from, item.to, item.amount)}
                  style={[styles.recordButton, savingSettlement !== null && styles.disabled]}>
                  <ThemedText style={styles.recordButtonText}>
                    {isSaving ? 'Recording…' : 'Record settlement'}
                  </ThemedText>
                </Pressable>
              </ThemedView>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.four,
  },
  separator: {
    height: Spacing.two,
  },
  settlementCard: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  settlementDescription: {
    gap: Spacing.one,
  },
  recordButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    padding: Spacing.two,
  },
  recordButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.65,
  },
});
