import { listSharedReceipts, uploadSharedReceipt } from './cloud';

const mockGetUser = jest.fn();
const mockUpload = jest.fn();
const mockList = jest.fn();
const mockSigned = jest.fn();
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: mockGetUser },
    storage: { from: () => ({ upload: mockUpload, list: mockList, createSignedUrls: mockSigned }) },
  }),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async () => 'receipt-digest',
}));
jest.mock('expo-file-system', () => ({
  File: class {
    exists = true;
    size = 100;
    extension = '.jpg';
    async arrayBuffer() {
      return new ArrayBuffer(1);
    }
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'account-a' } }, error: null });
});
it('does not upload a prior account receipt after switching accounts', async () => {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'account-b' } }, error: null });
  await expect(
    uploadSharedReceipt('account-a', 'group', 'bill', 'file:///photo.jpg'),
  ).rejects.toThrow('account changed');
  expect(mockUpload).not.toHaveBeenCalled();
});
it('uses an account-bound stable object path for explicit retryable uploads', async () => {
  mockUpload.mockResolvedValue({ error: null });
  await uploadSharedReceipt('account-a', 'group', 'bill', 'file:///photo.jpg');
  expect(mockUpload).toHaveBeenCalledWith(
    'group/bill/account-a_receipt-digest.jpg',
    expect.any(ArrayBuffer),
    { upsert: true, contentType: 'image/jpeg' },
  );
});
it('does not hide denied or failed private receipt links', async () => {
  mockList.mockResolvedValue({ data: [{ id: 'photo', name: 'a.jpg' }], error: null });
  mockSigned.mockResolvedValue({
    data: [{ path: 'group/bill/a.jpg', signedUrl: '', error: 'denied' }],
    error: null,
  });
  await expect(listSharedReceipts('account-a', 'group', 'bill')).rejects.toThrow(
    'could not be created',
  );
});
