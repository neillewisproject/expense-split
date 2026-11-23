import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { persistReceiptFile } from '@/features/expenses/data/receipt-files';

type Props = {
  uris: string[];
  onChange: (uris: string[]) => void;
  persistFiles?: boolean;
};

export function ReceiptPicker({ uris, onChange, persistFiles = true }: Props) {
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
    <View style={{ gap: 12 }}>
      <ThemedText type="smallBold">Receipt photos (stored on this device)</ThemedText>
      {uris.map((uri, index) => (
        <View key={uri} style={{ gap: 8 }}>
          <Image
            source={{ uri }}
            contentFit="contain"
            style={{ height: 160 }}
            accessibilityLabel={`Receipt ${index + 1}`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove receipt ${index + 1}`}
            onPress={() => onChange(uris.filter((item) => item !== uri))}>
            <ThemedText type="linkPrimary">Remove receipt {index + 1}</ThemedText>
          </Pressable>
        </View>
      ))}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pick(true)}>
        <ThemedText type="linkPrimary">{busy ? 'Attaching…' : 'Photograph receipt'}</ThemedText>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pick(false)}>
        <ThemedText type="linkPrimary">Choose receipt photos</ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        Photos are not uploaded automatically. OCR requires a separately approved native
        integration.
      </ThemedText>
      {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
    </View>
  );
}
