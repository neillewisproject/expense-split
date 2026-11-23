import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share, View as mockView } from 'react-native';
import type { GroupWithDetails } from '../domain/group';
import { GroupDetail } from './group-detail';

const mockLoad = jest.fn().mockResolvedValue(undefined);
let mockGroup: GroupWithDetails;
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: mockView }));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'group' }),
  router: { back: jest.fn(), push: jest.fn() },
}));
jest.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@/lib/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('../data/cloud-sync', () => ({
  fetchRemoteGroups: jest.fn(),
  resolveGroupConflict: jest.fn(),
}));
jest.mock('../store', () => ({
  useGroupsStore: (
    select: (state: {
      groups: GroupWithDetails[];
      status: 'ready';
      activeUserId: null;
      loadGroups: typeof mockLoad;
    }) => unknown,
  ) => select({ groups: [mockGroup], status: 'ready', activeUserId: null, loadGroups: mockLoad }),
}));
jest.mock('./group-controls', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const actual = jest.requireActual<typeof import('./group-controls')>('./group-controls');
  return {
    ...actual,
    GroupPage: ({ children }: { children: ReactNode }) =>
      React.createElement(mockView, null, children),
  };
});

it('previews the summary and only opens the share sheet after a separate action', async () => {
  const now = '2026-03-01T00:00:00.000Z';
  mockGroup = {
    id: 'group',
    name: 'Trip',
    currency: 'INR',
    ownerId: null,
    revision: 1,
    localRevision: 1,
    archivedAt: null,
    createdAt: now,
    syncUserId: null,
    syncStatus: 'local',
    inviteCode: null,
    conflictMessage: null,
    meMemberId: 'me',
    activity: [],
    expenses: [],
    members: [
      { id: 'me', groupId: 'group', name: 'Me', createdAt: now, deactivatedAt: null, userId: null },
    ],
  };
  const share = jest.spyOn(Share, 'share').mockResolvedValue({
    action: Share.dismissedAction,
    activityType: undefined,
  });
  await render(<GroupDetail />);
  expect(share).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Review shareable summary' }));
  expect(screen.getByText(/Group: Trip/)).toBeTruthy();
  expect(share).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Open share sheet' }));
  await waitFor(() =>
    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('Group: Trip'),
    }),
  );
  share.mockRestore();
});
