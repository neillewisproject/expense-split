import { deletePrivateBackup, fetchPrivateBackup, savePrivateBackup } from './cloud';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({ getSupabaseClient: () => ({ rpc: mockRpc }) }));

describe('private cloud backup', () => {
  beforeEach(() => mockRpc.mockReset());

  it('binds reads and writes to the account that initiated the action', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await fetchPrivateBackup('account-a')).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('get_personal_backup', {
      p_expected_user_id: 'account-a',
    });
    mockRpc.mockResolvedValueOnce({ data: 1, error: null });
    await savePrivateBackup('account-a', { version: 1, expenses: [] }, 0);
    expect(mockRpc).toHaveBeenLastCalledWith('save_personal_backup', {
      p_expected_user_id: 'account-a',
      p_document: { version: 1, expenses: [] },
      p_expected_revision: 0,
    });
  });

  it('does not hide conflicts or missing server acknowledgements', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'The cloud backup changed' } });
    await expect(savePrivateBackup('a', {}, 1)).rejects.toThrow('The cloud backup changed');
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(savePrivateBackup('a', {}, 1)).rejects.toThrow('valid backup revision');
  });

  it('binds deletion to a reviewed revision instead of deleting an unseen newer backup', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await deletePrivateBackup('a', 4)).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('delete_personal_backup', {
      p_expected_user_id: 'a',
      p_expected_revision: 4,
    });
  });
});
