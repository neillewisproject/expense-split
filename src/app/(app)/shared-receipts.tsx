import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Action, Failure, PersonalPage } from '@/features/expenses/components/personal-ui';
import { useAuth } from '@/features/auth/auth-provider';
import { useGroupsStore } from '@/features/groups/store';
import { listSharedReceipts, uploadSharedReceipt } from '@/features/receipts/cloud';

export default function SharedReceiptsScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const { user } = useAuth();
  return (
    <ReceiptPanel
      key={`${user?.id}:${groupId}:${expenseId}`}
      userId={user?.id}
      groupId={groupId}
      expenseId={expenseId}
    />
  );
}

function ReceiptPanel({
  userId,
  groupId,
  expenseId,
}: {
  userId?: string;
  groupId: string;
  expenseId: string;
}) {
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const expense = group?.expenses.find((item) => item.id === expenseId && !item.deletedAt);
  const [receipts, setReceipts] = useState<{ path: string; url: string }[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function refresh(nextOffset = 0) {
    if (!userId) return;
    const result = await listSharedReceipts(userId, groupId, expenseId, nextOffset);
    if (active.current) {
      setReceipts(result);
      setOffset(nextOffset);
    }
  }
  async function run(action: () => Promise<void>) {
    if (!active.current) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      if (active.current)
        setError(cause instanceof Error ? cause.message : 'Receipt sharing failed');
    } finally {
      if (active.current) setBusy(false);
    }
  }
  const canUpload = Boolean(
    userId &&
    group?.syncUserId === userId &&
    (expense?.authorId === userId || group?.ownerId === userId),
  );
  return (
    <PersonalPage title="Private shared receipts">
      <ThemedText>
        Upload only photos you want authorized members of this group to see. Sharing requires a
        synced expense and the private Storage migration. Local photos never upload automatically.
        Links expire after one minute; refresh to reopen.
      </ThemedText>
      {!expense || !userId || !group?.syncUserId ? (
        <ThemedText>Open a signed-in shared expense to view receipts.</ThemedText>
      ) : (
        <>
          <Action
            label="Refresh private receipt links"
            disabled={busy}
            onPress={() => void run(() => refresh())}
          />
          {receipts.map((receipt) => (
            <Image
              key={receipt.path}
              source={{ uri: receipt.url }}
              style={{ height: 220 }}
              contentFit="contain"
              accessibilityLabel="Shared receipt photo"
            />
          ))}
          <Action
            label="Previous receipt page"
            disabled={busy || offset === 0}
            onPress={() => void run(() => refresh(Math.max(0, offset - 100)))}
          />
          <Action
            label="Next receipt page"
            disabled={busy || receipts.length < 100}
            onPress={() => void run(() => refresh(offset + 100))}
          />
          {expense.receipts.map((uri, index) => (
            <Action
              key={uri}
              label={`Upload local receipt ${index + 1}`}
              disabled={busy || !canUpload}
              onPress={() => {
                Alert.alert(
                  'Share this receipt photo?',
                  'The image will be uploaded to your Supabase project and readable by current authorized group members.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Upload photo',
                      onPress: () =>
                        void run(async () => {
                          await uploadSharedReceipt(userId, groupId, expenseId, uri);
                          await refresh();
                        }),
                    },
                  ],
                );
              }}
            />
          ))}
        </>
      )}
      {busy ? <ThemedText themeColor="textSecondary">Working…</ThemedText> : null}
      <Failure message={error} />
    </PersonalPage>
  );
}
