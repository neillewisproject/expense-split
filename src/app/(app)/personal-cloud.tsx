import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PersonalPage } from '@/features/expenses/components/personal-ui';
import { useAuth } from '@/features/auth/auth-provider';
import { createBackup, restoreBackup } from '@/features/import-export/data/portability';
import { shareTextFile } from '@/features/import-export/device-files';
import { previewBackup, type PersonalBackup } from '@/features/import-export/domain/portability';
import {
  deletePrivateBackup,
  fetchPrivateBackup,
  savePrivateBackup,
} from '@/features/personal-cloud/cloud';

export default function PersonalCloudScreen() {
  const { user, isConfigured } = useAuth();
  return (
    <PersonalCloudPanel key={user?.id ?? 'guest'} userId={user?.id} isConfigured={isConfigured} />
  );
}

function PersonalCloudPanel({ userId, isConfigured }: { userId?: string; isConfigured: boolean }) {
  const user = userId ? { id: userId } : undefined;
  const account = useRef(userId);
  const [revision, setRevision] = useState<number | null>(null);
  const [local, setLocal] = useState<PersonalBackup | null>(null);
  const [cloud, setCloud] = useState<PersonalBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    account.current = userId;
    return () => {
      account.current = undefined;
    };
  }, [userId]);

  async function run(action: (userId: string) => Promise<void>) {
    const userId = user?.id;
    if (!userId || account.current !== userId) return;
    setBusy(true);
    setMessage(null);
    try {
      await action(userId);
    } catch (cause) {
      if (account.current === userId)
        setMessage(cause instanceof Error ? cause.message : 'Private backup failed');
    } finally {
      if (account.current === userId) setBusy(false);
    }
  }

  function summary(backup: PersonalBackup) {
    return `${backup.expenses.length} transactions, ${backup.accounts.length} accounts, ${backup.budgets.length} budgets, ${backup.rules.length} schedules, ${backup.goals.length} savings goals, ${backup.contributions.length} reservations/releases and ${backup.cashMovements.length} group cash movements. Photos omitted: ${backup.omittedReceiptCount}.`;
  }

  return (
    <PersonalPage title="Private personal backup">
      <ThemedText>
        Opt-in snapshots belong only to your signed-in account. Nothing uploads automatically. These
        backups contain financial records and group cash snapshot identifiers, but not signed-in
        user IDs, receipt image bytes or login tokens. This is manual backup/restore, not continuous
        bidirectional sync. Cloud snapshots are limited to 5 MB; local JSON document imports support
        up to 20 MB.
      </ThemedText>
      {!user || !isConfigured ? (
        <ThemedText>
          Configure Supabase and sign in to use private cloud backup. File backup remains available
          in Import / export.
        </ThemedText>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              void run(async (id) => {
                const snapshot = await fetchPrivateBackup(id);
                const parsed = snapshot ? previewBackup(JSON.stringify(snapshot.document)) : null;
                if (account.current !== id) return;
                setCloud(parsed);
                setRevision(snapshot?.revision ?? 0);
                setMessage(
                  snapshot
                    ? `Cloud revision ${snapshot.revision}, saved ${snapshot.updated_at}`
                    : 'No cloud copy exists yet.',
                );
              })
            }>
            <ThemedText type="linkPrimary">Check and review cloud copy</ThemedText>
          </Pressable>
          {cloud ? <ThemedText>Cloud: {summary(cloud)}</ThemedText> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              void run(async (id) => {
                const snapshot = previewBackup(await createBackup());
                if (account.current === id) setLocal(snapshot);
              })
            }>
            <ThemedText type="linkPrimary">Preview current local records</ThemedText>
          </Pressable>
          {local ? <ThemedText>Local: {summary(local)}</ThemedText> : null}
          <Pressable
            accessibilityRole="button"
            disabled={busy || !local || revision === null}
            onPress={() => {
              if (!local || revision === null) return;
              const selected = local,
                expected = revision;
              Alert.alert(
                'Upload reviewed snapshot?',
                'This replaces only your private cloud copy. It does not upload local groups. Other devices must download and review changes.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Upload',
                    onPress: () =>
                      void run(async (id) => {
                        const next = await savePrivateBackup(id, selected, expected);
                        if (account.current === id) {
                          setRevision(next);
                          setCloud(selected);
                          setMessage(`Saved cloud revision ${next}.`);
                        }
                      }),
                  },
                ],
              );
            }}>
            <ThemedText type="linkPrimary">Upload reviewed local snapshot</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() =>
              void run(async (id) => {
                await shareTextFile(await createBackup(), 'json');
                if (account.current === id)
                  setMessage(
                    'Export dialog completed. Confirm you saved the file before restoring.',
                  );
              })
            }>
            <ThemedText type="linkPrimary">Export current records before restoring</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: exported }}
            onPress={() => setExported(!exported)}>
            <ThemedText>
              {exported ? '[x]' : '[ ]'} I saved a recovery copy of my current records
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !cloud || !exported}
            onPress={() => {
              if (!cloud) return;
              const selected = cloud;
              Alert.alert(
                'Replace local personal records?',
                'Accounts, transactions, budgets, schedules, savings goals, category rules and group cash movements and matches will be replaced. Older backups contain no category rules. Versions 1–3 contain no group cash movements; version 4 contains no matches; older budgets use personal-only spending. Group ledgers are untouched. Receipt images are not restored from cloud.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Replace local records',
                    style: 'destructive',
                    onPress: () =>
                      void run(async (id) => {
                        if (account.current !== id)
                          throw new Error('Your account changed. Review the backup again.');
                        await restoreBackup(JSON.stringify(selected), () => {
                          if (account.current !== id)
                            throw new Error('Your account changed. Review the backup again.');
                        });
                        if (account.current === id) {
                          setLocal(selected);
                          setExported(false);
                          setMessage('Reviewed financial records restored.');
                        }
                      }),
                  },
                ],
              );
            }}>
            <ThemedText type="linkPrimary">Restore reviewed cloud records</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy || !cloud || revision === null}
            onPress={() => {
              if (revision === null) return;
              const expected = revision;
              Alert.alert(
                'Delete private cloud copy?',
                'This deletes only your cloud backup, not your on-device records or shared groups.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete cloud copy',
                    style: 'destructive',
                    onPress: () =>
                      void run(async (id) => {
                        await deletePrivateBackup(id, expected);
                        if (account.current === id) {
                          setCloud(null);
                          setRevision(0);
                          setMessage('No cloud backup remains. Local records are unchanged.');
                        }
                      }),
                  },
                ],
              );
            }}>
            <ThemedText type="linkPrimary">Delete reviewed cloud copy</ThemedText>
          </Pressable>
        </>
      )}
      {busy ? <ThemedText>Working…</ThemedText> : null}
      {message ? <ThemedText accessibilityRole="alert">{message}</ThemedText> : null}
    </PersonalPage>
  );
}
