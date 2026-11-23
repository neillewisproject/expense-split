import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Banner, Button, Icon, neu } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { persistReceiptFile } from '@/features/expenses/data/receipt-files';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  uris: string[];
  onChange: (uris: string[]) => void;
  persistFiles?: boolean;
};

export function ReceiptPicker({ uris, onChange, persistFiles = true }: Props) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(camera: boolean) {
    setError(null);
    setBusy(true);
    try {
      if (uris.length >= 10) throw new Error('Keep at most ten photos per entry');
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error('Camera access was denied. You can still choose a photo.');
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: 10 - uris.length,
            quality: 0.8,
          });
      if (!result.canceled) {
        const persisted: string[] = [];
        for (const asset of result.assets.slice(0, 10 - uris.length)) {
          persisted.push(persistFiles ? await persistReceiptFile(asset.uri) : asset.uri);
        }
        onChange([...new Set([...uris, ...persisted])]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not attach the receipt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
        Receipt photos (stored on this device)
      </ThemedText>
      {uris.length ? (
        <View style={styles.thumbs}>
          {uris.map((uri, index) => (
            <View
              key={uri}
              style={[styles.thumb, { backgroundColor: theme.card }, neu(theme, 'raisedSm')]}>
              <Image
                source={{ uri }}
                contentFit="cover"
                style={styles.image}
                accessibilityLabel={`Receipt ${index + 1}`}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove receipt ${index + 1}`}
                hitSlop={8}
                onPress={() => onChange(uris.filter((item) => item !== uri))}
                style={[styles.remove, { backgroundColor: theme.danger }]}>
                <Icon name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          variant="secondary"
          icon="camera"
          label={busy ? 'Attaching…' : 'Photograph receipt'}
          disabled={busy}
          onPress={() => void pick(true)}
          style={styles.action}
        />
        <Button
          variant="secondary"
          icon="photos"
          label="Choose receipt photos"
          disabled={busy}
          onPress={() => void pick(false)}
          style={styles.action}
        />
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        Photos are not uploaded automatically. OCR requires a separately approved native
        integration.
      </ThemedText>
      {error ? <Banner tone="danger" message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  label: { fontWeight: 600 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  thumb: { width: 96, height: 96, borderRadius: Radius.md, padding: 4 },
  image: { flex: 1, borderRadius: Radius.sm },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  action: { flexGrow: 1 },
});
