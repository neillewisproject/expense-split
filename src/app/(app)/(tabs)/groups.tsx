import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Fab,
  Icon,
  ListRow,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { sharedGroupsQueryKey } from '@/features/groups/components/group-cloud-sync';
import type { GroupWithDetails } from '@/features/groups/domain/group';
import { useGroupsStore } from '@/features/groups/store';
import { useTheme } from '@/hooks/use-theme';

export default function GroupsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const groups = useGroupsStore((state) => state.groups);
  const status = useGroupsStore((state) => state.status);
  const error = useGroupsStore((state) => state.error);
  const syncError = useGroupsStore((state) => state.syncError);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const retryPendingSync = useGroupsStore((state) => state.retryPendingSync);

  useEffect(() => {
    if (status === 'idle') void loadGroups(user?.id);
  }, [loadGroups, status, user?.id]);

  function retryCloudSync() {
    retryPendingSync();
    if (user) void queryClient.invalidateQueries({ queryKey: sharedGroupsQueryKey(user.id) });
  }

  return (
    <View style={styles.root}>
      <Screen
        tabBar
        scroll={false}
        header={
          <ScreenHeader
            large
            title="Groups"
            subtitle={user ? 'Synced with your account' : 'Saved on this device'}
            right={
              user ? undefined : (
                <Button
                  variant="secondary"
                  icon="sync"
                  label="Sign in to sync"
                  onPress={() => router.push('/sign-in')}
                />
              )
            }
          />
        }>
        <FlatList
          data={groups}
          keyExtractor={(group) => group.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListHeaderComponent={
            <View style={styles.header}>
              {error ? (
                <Banner
                  tone="danger"
                  message={error}
                  actionLabel="Try again"
                  onAction={() => void loadGroups(user?.id)}
                />
              ) : null}
              {syncError ? (
                <Banner
                  tone="warning"
                  message={syncError}
                  actionLabel="Retry sync"
                  onAction={retryCloudSync}
                />
              ) : null}
              <Card padded={false}>
                <ListRow
                  icon="people"
                  title="People"
                  subtitle="Two-person balances across all groups"
                  onPress={() => router.push('/groups/people')}
                />
              </Card>
            </View>
          }
          ListEmptyComponent={
            status === 'loading' ? (
              <ThemedText themeColor="textSecondary">Loading groups…</ThemedText>
            ) : (
              <EmptyState
                icon="groups"
                title="No groups yet"
                message="Create a group for a trip, flat or event to split costs and see who owes whom."
              />
            )
          }
          renderItem={({ item }) => <GroupCard group={item} />}
        />
      </Screen>
      <Fab label="New group" onPress={() => router.push('/groups/create')} />
    </View>
  );
}

function GroupCard({ group }: { group: GroupWithDetails }) {
  const theme = useTheme();
  const status =
    group.syncStatus === 'conflict'
      ? { label: 'Needs attention', color: theme.danger, background: theme.dangerSoft }
      : group.syncStatus === 'pending'
        ? { label: 'Sync pending', color: theme.warning, background: theme.warningSoft }
        : group.syncUserId
          ? { label: 'Shared', color: theme.success, background: theme.successSoft }
          : {
              label: 'This device',
              color: theme.textSecondary,
              background: theme.backgroundElement,
            };
  const expenses = group.expenses.filter((expense) => !expense.deletedAt).length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${group.members.length} members, ${status.label}`}
      onPress={() => router.push({ pathname: '/groups/[id]', params: { id: group.id } })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.backgroundElement : theme.card,
          borderColor: theme.border,
        },
        group.archivedAt && styles.archived,
      ]}>
      <Avatar name={group.name} size={48} />
      <View style={styles.cardBody}>
        <ThemedText type="heading" numberOfLines={1}>
          {group.name}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {group.members.length} {group.members.length === 1 ? 'member' : 'members'} · {expenses}{' '}
          {expenses === 1 ? 'expense' : 'expenses'}
          {group.archivedAt ? ' · Archived' : ''}
        </ThemedText>
        <View style={[styles.badge, { backgroundColor: status.background }]}>
          <ThemedText type="caption" style={{ color: status.color, fontWeight: 600 }}>
            {status.label}
          </ThemedText>
        </View>
      </View>
      <Icon name="chevronRight" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: Spacing.two, paddingBottom: Spacing.three },
  listContent: { flexGrow: 1, paddingBottom: BottomTabInset + 96 },
  separator: { height: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  archived: { opacity: 0.6 },
  cardBody: { flex: 1, minWidth: 0, gap: 2 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
