import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import {
  cacheRemoteGroups,
  fetchRemoteGroups,
  syncGroupSnapshot,
} from '@/features/groups/data/cloud-sync';
import { useGroupsStore } from '@/features/groups/store';
import { getSupabaseClient } from '@/lib/supabase';

export const sharedGroupsQueryKey = (userId: string) => ['shared-groups', userId] as const;

export function GroupCloudSync() {
  const { user, isConfigured } = useAuth();
  const queryClient = useQueryClient();
  const network = Network.useNetworkState();
  const pendingIds = useGroupsStore((state) =>
    state.groups
      .filter((group) => group.syncStatus === 'pending' && group.syncUserId === user?.id)
      .map((group) => group.id),
  );
  const pendingKey = pendingIds.join('|');
  const retryVersion = useGroupsStore((state) => state.syncRetry);
  const lastSyncError = useGroupsStore((state) => state.setSyncError);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const activeSyncs = useRef(new Set<string>());
  const userId = user?.id;
  const queryKey = userId ? sharedGroupsQueryKey(userId) : ['shared-groups', 'signed-out'];
  const cloudGroups = useQuery({
    queryKey,
    queryFn: () => fetchRemoteGroups(userId!),
    enabled: Boolean(userId && isConfigured),
  });

  const syncMutation = useMutation({
    mutationFn: (groupId: string) => syncGroupSnapshot(userId!, groupId),
    onSuccess: async (inviteCode, groupId) => {
      await useGroupsStore.getState().markGroupSynced(groupId, inviteCode);
      await queryClient.invalidateQueries({ queryKey: sharedGroupsQueryKey(userId!) });
      lastSyncError(null);
    },
    onError: (error) => {
      lastSyncError(`A group is saved on this device but has not synced: ${error.message}`);
    },
  });
  const mutateSyncGroup = syncMutation.mutate;

  useEffect(() => {
    void loadGroups(userId);
  }, [loadGroups, userId]);

  useEffect(() => {
    if (!userId || !cloudGroups.data) return;
    void cacheRemoteGroups(cloudGroups.data, userId)
      .then(() => loadGroups(userId))
      .catch((error: unknown) => {
        lastSyncError(
          `Could not save shared groups on this device: ${
            error instanceof Error ? error.message : 'Unexpected local database error.'
          }`,
        );
      });
  }, [cloudGroups.data, lastSyncError, loadGroups, userId]);

  useEffect(() => {
    if (cloudGroups.error) {
      lastSyncError(`Could not load shared groups: ${cloudGroups.error.message}`);
    }
  }, [cloudGroups.error, lastSyncError]);

  useEffect(() => {
    if (!userId || !isConfigured || !network.isConnected || network.isInternetReachable === false)
      return;
    for (const groupId of pendingKey ? pendingKey.split('|') : []) {
      if (activeSyncs.current.has(groupId)) continue;
      activeSyncs.current.add(groupId);
      mutateSyncGroup(groupId, {
        onSettled: () => activeSyncs.current.delete(groupId),
      });
    }
  }, [
    isConfigured,
    mutateSyncGroup,
    network.isConnected,
    network.isInternetReachable,
    pendingKey,
    retryVersion,
    userId,
  ]);

  useEffect(() => {
    if (!userId || !isConfigured) return;
    const client = getSupabaseClient();
    const refreshGroups = () => {
      void queryClient.invalidateQueries({ queryKey: sharedGroupsQueryKey(userId) });
    };
    const channel = client
      .channel(`shared-groups:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_access',
          filter: `user_id=eq.${userId}`,
        },
        refreshGroups,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, refreshGroups)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members' },
        refreshGroups,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_expenses' },
        refreshGroups,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expense_splits' },
        refreshGroups,
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          lastSyncError('Live group updates are unavailable. Pull to refresh or try again later.');
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [isConfigured, lastSyncError, queryClient, userId]);

  return null;
}
