import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { usePersonalStore } from '@/features/accounts/store';
import {
  Action,
  Choices,
  Failure,
  Field,
  PersonalPage,
  message,
} from '@/features/expenses/components/personal-ui';
import { useExpensesStore } from '@/features/expenses/store';
import { createBackup, createCsv, importCsv, restoreBackup } from '../data/portability';
import { previewBackup, previewCsv } from '../domain/portability';
import { pickTextFile, shareTextFile } from '../device-files';

export function PortabilityScreen() {
  const entries = useExpensesStore((state) => state.expenses);
  const accounts = usePersonalStore((state) => state.accounts);
  const loadEntries = useExpensesStore((state) => state.loadExpenses);
  const load = usePersonalStore((state) => state.load);
  const [mode, setMode] = useState('csv');
  const [text, setText] = useState('');
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadEntries();
    void load();
  }, [loadEntries, load]);
  function updateText(value: string) {
    setText(value);
    setPreviewSource(null);
    setPreviewText(null);
    setConfirmation('');
  }
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      await operation();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  function preview() {
    setError(null);
    setFeedback(null);
    setPreviewSource(null);
    setPreviewText(null);
    try {
      if (mode === 'csv') {
        const result = previewCsv(text, accounts, entries);
        setPreviewText(
          `${result.entries.length} new entries; ${result.duplicates} exact ID duplicates skipped. ${result.errors.length} errors.${result.errors.length ? `\n${result.errors.slice(0, 10).join('\n')}` : ''}`,
        );
        if (!result.errors.length) setPreviewSource(text);
      } else {
        const result = previewBackup(text);
        setPreviewText(
          `Replace personal data with ${result.expenses.length} transactions (including trash), ${result.accounts.length} accounts, ${result.budgets.length} budgets, ${result.rules.length} schedules, ${result.drafts.length} drafts and ${result.cashMovements.length} group cash movements. ${result.omittedReceiptCount} receipt photos are not included.${result.skippedGoalCount ? ` ${result.skippedGoalCount} savings goals in this older backup will be skipped because the feature was removed.` : ''} Group ledgers are untouched.`,
        );
        setPreviewSource(text);
      }
    } catch (err) {
      setError(message(err));
    }
  }
  return (
    <PersonalPage title="Import, export and recovery">
      <ThemedText>
        CSV uses the exported column template, ISO dates, currency-aware decimal amounts, JSON tags,
        and local account IDs. Import requires a valid preview. JSON v8 restores personal financial
        records/settings, category rules, budget basis and carryover, group cash snapshots and
        transaction matches, and schedule time zones/end dates. Versions 1–7 are accepted; savings
        goals in versions 2–7 are skipped because the feature was removed. Older backups have no
        category rules and replace existing rules with none. Older budgets use the personal-only
        basis. Versions 1–3 have no group cash movements, and version 4 has no transaction matches.
        Restoring any backup replaces existing group cash movements, even when the backup contains
        none. Older schedules use the device time zone. Cash snapshots include group, entry,
        participant and local account identifiers, but not signed-in user IDs. No auth tokens or
        group ledgers are included. Receipt image bytes are NOT backed up; existing same-ID local
        photos are retained, imported file URIs are rejected. This is not a lossless attachment
        bundle.
      </ThemedText>
      <Choices
        values={[
          { value: 'csv', label: 'CSV' },
          { value: 'json', label: 'JSON backup' },
        ]}
        value={mode}
        onChange={(value) => {
          setMode(value);
          updateText('');
        }}
      />
      <Failure message={error} />
      <Action
        label={`Generate ${mode.toUpperCase()} export text`}
        disabled={busy}
        onPress={() =>
          void run(async () =>
            updateText(mode === 'csv' ? await createCsv() : await createBackup()),
          )
        }
      />
      <Action
        label="Read text file"
        disabled={busy}
        onPress={() =>
          void run(async () => {
            const content = await pickTextFile();
            if (content !== null) updateText(content);
          })
        }
      />
      <Field
        label="CSV / JSON text (paste or select file)"
        value={text}
        onChange={updateText}
        multiline
      />
      <Action
        label="Share current text as file"
        disabled={busy || !text}
        onPress={() => void run(() => shareTextFile(text, mode as 'csv' | 'json'))}
      />
      <Action label="Validate and preview import" disabled={busy || !text} onPress={preview} />
      {previewText ? <ThemedText accessibilityRole="alert">{previewText}</ThemedText> : null}
      {mode === 'json' && previewSource ? (
        <Field
          label="Type REPLACE PERSONAL DATA to confirm replacement"
          value={confirmation}
          onChange={setConfirmation}
        />
      ) : null}
      <Action
        label={
          mode === 'csv' ? 'Import previewed new entries' : 'Restore previewed personal backup'
        }
        disabled={
          busy ||
          previewSource !== text ||
          !previewSource ||
          (mode === 'json' && confirmation !== 'REPLACE PERSONAL DATA')
        }
        onPress={() =>
          void run(async () => {
            if (previewSource !== text || !previewSource)
              throw new Error('Preview the current text first');
            if (mode === 'csv') setFeedback(`Imported ${await importCsv(text)} entries.`);
            else {
              if (confirmation !== 'REPLACE PERSONAL DATA')
                throw new Error('Confirm personal-data replacement');
              await restoreBackup(text);
              setFeedback(
                'Personal financial records restored. Groups were not changed. Receipt files were not imported.',
              );
            }
            setPreviewSource(null);
            setConfirmation('');
          })
        }
      />
      {feedback ? <ThemedText accessibilityRole="alert">{feedback}</ThemedText> : null}
    </PersonalPage>
  );
}
