import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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
    mutationFn: () => {
      if (!code) throw new Error('This group invitation is missing its code.');
      return joinGroupByInvite(code);
    },
    onSuccess: async (_groupId, _variables, _context, _mutation) => {
      if (user) {
        await queryClient.invalidateQueries({ queryKey: sharedGroupsQueryKey(user.id) });
        await loadGroups(user.id);
      }
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
        <ThemedText type="subtitle">Join a shared group</ThemedText>
        <ThemedText themeColor="textSecondary">
          The invitation is only accepted after you sign in.
        </ThemedText>
        {!code ? (
          <ThemedText accessibilityRole="alert" style={styles.error}>
            This invitation link is missing its code.
          </ThemedText>
        ) : !user ? (
          <>
            {!isConfigured ? (
              <ThemedText accessibilityRole="alert" style={styles.error}>
                Supabase is not configured on this app. Set it up before accepting invitations.
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={!isConfigured}
              onPress={continueToSignIn}
              style={[styles.button, !isConfigured && styles.disabled]}>
              <ThemedText style={styles.buttonText}>Sign in to join</ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            {joinMutation.error ? (
              <ThemedText accessibilityRole="alert" style={styles.error}>
                {joinMutation.error.message}
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={joinMutation.isPending}
              onPress={() => joinMutation.mutate()}
              style={[styles.button, joinMutation.isPending && styles.disabled]}>
              <ThemedText style={styles.buttonText}>
                {joinMutation.isPending ? 'Joining…' : 'Join group'}
              </ThemedText>
            </Pressable>
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
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    padding: Spacing.three,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  error: {
    color: '#b42318',
  },
});
