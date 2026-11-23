import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Banner } from '@/components/ui';
import { Action, Failure, PersonalPage } from '@/features/expenses/components/personal-ui';
import { useAppLock } from '@/features/privacy/app-lock';

export default function PrivacyScreen() {
  const { enabled, setEnabled } = useAppLock();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await setEnabled(!enabled);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change app lock');
    } finally {
      setBusy(false);
    }
  }
  return (
    <PersonalPage title="Privacy and app lock">
      <Banner
        tone={enabled ? 'success' : 'info'}
        message={`App lock is ${enabled ? 'on' : 'off'}`}
      />
      <Action
        variant="primary"
        label={busy ? 'Authenticating…' : `${enabled ? 'Disable' : 'Enable'} device lock`}
        disabled={busy}
        onPress={() => void toggle()}
      />
      {error ? <Failure message={error} /> : null}
      <ThemedText>
        Device lock hides app content at startup and after backgrounding. It is not database
        encryption. Your device passcode can be used if biometrics are unavailable. Face ID requires
        an iOS development build.
      </ThemedText>
      <ThemedText>
        Existing local groups and personal records are not uploaded automatically. Shared groups and
        explicitly uploaded private backups use Supabase. Receipt photos stay on this device unless
        you explicitly share them from a saved shared expense.
      </ThemedText>
      <ThemedText>
        File exports can contain financial details. Store them privately. No bank connections,
        payment processing, or cloud OCR are enabled.
      </ThemedText>
    </PersonalPage>
  );
}
