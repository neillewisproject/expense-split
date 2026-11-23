import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Banner, Button, IconBadge } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import { joinGroupByInvite } from '@/features/groups/data/cloud-sync';
import { sharedGroupsQueryKey } from '@/features/groups/components/group-cloud-sync';
import { useGroupsStore } from '@/features/groups/store';

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function JoinGroupScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code?: string | string[] }>();
  const code = getSingleParam(rawCode);
  const { user, isConfigured } = useAuth();
  const queryClient = useQueryClient();
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const joinMutation = useMutation({
    mutationFn: (accountId: string) => {
      if (!code) throw new Error('This group invitation is missing its code.');
      return joinGroupByInvite(code, accountId);
    },
    onSuccess: async (_groupId, accountId) => {
      if (useGroupsStore.getState().activeUserId !== accountId) return;
      await queryClient.invalidateQueries({ queryKey: sharedGroupsQueryKey(accountId) });
      await loadGroups(accountId);
      router.replace('/groups');
    },
  });

  function continueToSignIn() {
    if (!code) return;
    router.push({ pathname: '/sign-in', params: { inviteCode: code } });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <IconBadge icon="groups" size={56} />
        <ThemedText type="subtitle">Join a shared group</ThemedText>
        <ThemedText themeColor="textSecondary">
          The invitation is only accepted after you sign in.
        </ThemedText>
        {!code ? (
          <Banner tone="danger" message="This invitation link is missing its code." />
        ) : !user ? (
          <>
            {!isConfigured ? (
              <Banner
                tone="danger"
                message="Supabase is not configured on this app. Set it up before accepting invitations."
              />
            ) : null}
            <Button
              icon="signIn"
              label="Sign in to join"
              disabled={!isConfigured}
              onPress={continueToSignIn}
            />
          </>
        ) : (
          <>
            {joinMutation.error ? (
              <Banner tone="danger" message={joinMutation.error.message} />
            ) : null}
            <Button
              icon="groups"
              label={joinMutation.isPending ? 'Joining…' : 'Join group'}
              loading={joinMutation.isPending}
              onPress={() => joinMutation.mutate(user.id)}
            />
          </>
        )}
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
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
});
