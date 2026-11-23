import type { GroupWithDetails } from './group';

export function assertAdministrativeReady(
  group: GroupWithDetails,
  userId: string,
  operationCount: number,
  requireOwner: boolean,
): void {
  if (group.syncUserId !== userId) throw new Error('Open a shared group for the current account.');
  if (group.syncStatus !== 'synced' || operationCount > 0) {
    throw new Error(
      'Sync or resolve every pending local operation before changing access, ownership, or invites.',
    );
  }
  if (requireOwner && group.ownerId !== userId)
    throw new Error('Only the owner can change access, ownership, or invites.');
}
