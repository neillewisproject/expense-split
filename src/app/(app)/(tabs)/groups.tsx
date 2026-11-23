import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { sharedGroupsQueryKey } from '@/features/groups/components/group-cloud-sync';
import { useGroupsStore } from '@/features/groups/store';

export default function GroupsScreen() {
  const { user, signOut } = useAuth();
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

  function handleSignOut() {
    Alert.alert('Sign out?', 'Shared groups will be hidden until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut().catch((signOutError: unknown) => {
            Alert.alert(
              'Could not sign out',
              signOutError instanceof Error ? signOutError.message : 'Please try again.',
            );
          });
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">Groups</ThemedText>
          {user ? (
            <Pressable
              accessibilityRole="button"
              onPress={handleSignOut}
              style={styles.accountButton}>
              <ThemedText type="small" themeColor="textSecondary">
                Sign out
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/sign-in')}
              style={styles.accountButton}>
              <ThemedText type="small" themeColor="textSecondary">
                Sign in to sync
              </ThemedText>
            </Pressable>
          )}
        </View>
        {error ? (
          <View accessibilityRole="alert" style={styles.error}>
            <ThemedText type="small">{error}</ThemedText>
            <Pressable accessibilityRole="button" onPress={() => void loadGroups(user?.id)}>
              <ThemedText type="linkPrimary">Try again</ThemedText>
            </Pressable>
          </View>
        ) : null}
        {syncError ? (
          <View accessibilityRole="alert" style={styles.syncError}>
            <ThemedText type="small">{syncError}</ThemedText>
            <Pressable accessibilityRole="button" onPress={retryCloudSync}>
              <ThemedText type="linkPrimary">Retry sync</ThemedText>
            </Pressable>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/groups/people')}>
          <ThemedText type="linkPrimary">People · two-person ledgers</ThemedText>
        </Pressable>
        <FlatList
          data={groups}
          keyExtractor={(group) => group.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            status === 'loading' ? (
              <ThemedText themeColor="textSecondary">Loading groups…</ThemedText>
            ) : (
              <EmptyState
                title="No groups yet"
                message="Create a group to track shared expenses and see who owes whom."
              />
            )
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/groups/[id]', params: { id: item.id } })}
              style={styles.groupRow}>
              <View style={styles.groupDetails}>
                <ThemedText type="smallBold">{item.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.members.length} members · {item.expenses.length} expenses
                  {item.archivedAt ? ' · Archived' : ''}
                  {item.syncStatus === 'conflict' ? ' · Conflict: open to resolve' : ''}
                  {item.syncStatus === 'pending'
                    ? ' · Sync pending'
                    : item.syncUserId
                      ? ' · Shared'
                      : ' · On this device'}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                ›
              </ThemedText>
            </Pressable>
          )}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/groups/create')}
          style={styles.createButton}>
          <ThemedText style={styles.createButtonText}>+ Create group</ThemedText>
        </Pressable>
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.three,
  },
  groupRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  groupDetails: {
    flex: 1,
    gap: Spacing.one,
  },
  createButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  error: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#fce8e6',
  },
  syncError: {
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: Spacing.two,
    backgroundColor: '#fff3cd',
  },
});
