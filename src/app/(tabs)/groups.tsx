import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useGroupsStore } from '@/features/groups/store';

export default function GroupsScreen() {
  const groups = useGroupsStore((state) => state.groups);
  const status = useGroupsStore((state) => state.status);
  const error = useGroupsStore((state) => state.error);
  const loadGroups = useGroupsStore((state) => state.loadGroups);

  useEffect(() => {
    if (status === 'idle') void loadGroups();
  }, [loadGroups, status]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">Groups</ThemedText>
        {error ? (
          <View accessibilityRole="alert" style={styles.error}>
            <ThemedText type="small">{error}</ThemedText>
            <Pressable accessibilityRole="button" onPress={() => void loadGroups()}>
              <ThemedText type="linkPrimary">Try again</ThemedText>
            </Pressable>
          </View>
        ) : null}
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
});
