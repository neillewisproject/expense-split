import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useMemo } from 'react';
import { Alert, FlatList, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { computeBalances, simplifyDebts } from '@/features/expenses/domain/balances';
import { formatMoney } from '@/features/expenses/domain/money';
import type { GroupExpense } from '@/features/groups/domain/group';
import { useGroupsStore } from '@/features/groups/store';

function formatGroupDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === id));
  const status = useGroupsStore((state) => state.status);
  const error = useGroupsStore((state) => state.error);
  const loadGroups = useGroupsStore((state) => state.loadGroups);

  useEffect(() => {
    if (status === 'idle') void loadGroups(user?.id);
  }, [loadGroups, status, user?.id]);

  const balances = useMemo(() => computeBalances(group?.expenses ?? []), [group?.expenses]);
  const suggestedSettlements = useMemo(() => simplifyDebts(balances), [balances]);
  const memberNames = useMemo(
    () => new Map(group?.members.map((member) => [member.id, member.name]) ?? []),
    [group?.members],
  );

  async function shareInvite() {
    if (!group?.inviteCode) return;
    const inviteUrl = Linking.createURL(`/join/${group.inviteCode}`);
    try {
      await Share.share({
        message: `Join ${group.name} on Expense Split: ${inviteUrl}`,
        url: inviteUrl,
      });
    } catch (error) {
      Alert.alert(
        'Could not share invitation',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }

  if (!group) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">
            {status === 'loading' || status === 'idle' ? 'Loading group…' : 'Group not found'}
          </ThemedText>
          {status !== 'loading' && status !== 'idle' ? (
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <ThemedText type="linkPrimary">Go back</ThemedText>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </ThemedView>
    );
  }

  const Header = (
    <View style={styles.listHeader}>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <ThemedText type="linkPrimary">‹ Groups</ThemedText>
      </Pressable>
      <ThemedText type="subtitle">{group.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {group.members.length} members · {group.expenses.length} expenses
      </ThemedText>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/groups/[id]/add-expense', params: { id } })}
          style={styles.primaryButton}>
          <ThemedText style={styles.primaryButtonText}>+ Add expense</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: suggestedSettlements.length === 0 }}
          disabled={suggestedSettlements.length === 0}
          onPress={() => router.push({ pathname: '/groups/[id]/settle-up', params: { id } })}
          style={[styles.secondaryButton, suggestedSettlements.length === 0 && styles.disabled]}>
          <ThemedText style={styles.secondaryButtonText}>Settle up</ThemedText>
        </Pressable>
      </View>
      {group.inviteCode ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void shareInvite()}
          style={styles.inviteButton}>
          <ThemedText style={styles.inviteButtonText}>Share group invite</ThemedText>
        </Pressable>
      ) : group.syncStatus === 'pending' ? (
        <ThemedText type="small" themeColor="textSecondary">
          This group is saved on this device and will be shared when it syncs.
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Local-only group. Sign in and create a new group to share it.
        </ThemedText>
      )}
      <ThemedText type="smallBold">Balances</ThemedText>
      <ThemedView type="backgroundElement" style={styles.memberCard}>
        {group.members.map((member) => {
          const balance = balances[member.id] ?? 0;
          const summary =
            balance > 0
              ? `gets back ${formatMoney(balance)}`
              : balance < 0
                ? `owes ${formatMoney(Math.abs(balance))}`
                : 'is settled';
          return (
            <View key={member.id} style={styles.memberRow}>
              <ThemedText type="smallBold">{member.name}</ThemedText>
              <ThemedText type="small" themeColor={balance === 0 ? 'textSecondary' : 'text'}>
                {summary}
              </ThemedText>
            </View>
          );
        })}
      </ThemedView>
      <ThemedText type="smallBold">Activity</ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {error ? (
          <View accessibilityRole="alert" style={styles.error}>
            <ThemedText type="small">{error}</ThemedText>
          </View>
        ) : null}
        <FlatList
          data={group.expenses}
          keyExtractor={(expense) => expense.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <EmptyState
              title="No group expenses yet"
              message="Add the first shared expense to start tracking balances."
            />
          }
          ListHeaderComponent={Header}
          renderItem={({ item }) => renderGroupExpense(item, memberNames)}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function renderGroupExpense(
  expense: GroupExpense,
  memberNames: Map<string, string>,
): React.JSX.Element {
  const isSettlement = expense.kind === 'settlement';
  const splitSummary = Object.entries(expense.split)
    .map(
      ([memberId, amount]) =>
        `${memberNames.get(memberId) ?? 'Unknown member'} ${formatMoney(amount)}`,
    )
    .join(' · ');
  return (
    <ThemedView type="backgroundElement" style={styles.expenseRow}>
      <View style={styles.expenseDescription}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {expense.description}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {isSettlement
            ? `Settlement · ${formatGroupDate(expense.date)}`
            : `${memberNames.get(expense.paidBy) ?? 'Unknown member'} paid · ${formatGroupDate(expense.date)}`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {splitSummary}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{formatMoney(expense.amount)}</ThemedText>
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
    paddingHorizontal: Spacing.four,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: Spacing.four,
  },
  listHeader: {
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.two,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#3c87f7',
    paddingHorizontal: Spacing.two,
  },
  secondaryButtonText: {
    color: '#3c87f7',
    fontWeight: '700',
  },
  inviteButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: '#3c87f7',
    paddingHorizontal: Spacing.two,
  },
  inviteButtonText: {
    color: '#3c87f7',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  memberCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  expenseDescription: {
    flex: 1,
    gap: Spacing.one,
  },
  separator: {
    height: Spacing.two,
  },
  error: {
    marginTop: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#fce8e6',
  },
});
