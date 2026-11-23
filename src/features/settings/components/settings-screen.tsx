import { useEffect, useState } from 'react';
import { ThemedText } from '@/components/themed-text';
import { usePersonalStore } from '@/features/accounts/store';
import {
  Action,
  Failure,
  Field,
  PersonalPage,
  message,
} from '@/features/expenses/components/personal-ui';
import { parseTags } from '@/features/expenses/domain/expense';

export function PersonalSettingsScreen() {
  const defaultCurrency = usePersonalStore((state) => state.defaultCurrency);
  const categories = usePersonalStore((state) => state.categories);
  const loaded = usePersonalStore((state) => state.loaded);
  const load = usePersonalStore((state) => state.load);
  const save = usePersonalStore((state) => state.saveSettings);
  const storeError = usePersonalStore((state) => state.error);
  const [currencyDraft, setCurrency] = useState<string | null>(null);
  const [customDraft, setCustom] = useState<string | null>(null);
  const currency = currencyDraft ?? defaultCurrency;
  const custom = customDraft ?? categories.join(', ');
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);
  return (
    <PersonalPage title="Personal preferences">
      <ThemedText>
        Personal transactions remain on this device. No personal cloud upload, live exchange-rate
        service, biometric lock, or OS notifications are enabled by these settings.
      </ThemedText>
      <Failure message={storeError} />
      <Field
        label="Default currency"
        value={currency}
        onChange={(value) => setCurrency(value.toUpperCase())}
      />
      <Field
        label="Custom categories (comma separated)"
        value={custom}
        onChange={setCustom}
        multiline
      />
      <ThemedText>
        Removing a custom category from this list does not change historical transactions. Tags and
        notes can be edited on each transaction.
      </ThemedText>
      <Action
        label="Save preferences"
        onPress={() => {
          setFeedback(null);
          void save(currency, parseTags(custom))
            .then(() => setFeedback('Preferences saved'))
            .catch((err: unknown) => setFeedback(message(err)));
        }}
      />
      {feedback ? <ThemedText accessibilityRole="alert">{feedback}</ThemedText> : null}
    </PersonalPage>
  );
}
