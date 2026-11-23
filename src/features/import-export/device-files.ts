import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

const MAX_DOCUMENT_BYTES = 20_000_000;

export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'application/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) throw new Error('The selected document could not be read');
  if (Platform.OS === 'web') {
    if (!asset.file) throw new Error('The browser did not provide a readable document');
    if (asset.file.size > MAX_DOCUMENT_BYTES)
      throw new Error('Choose a document no larger than 20 MB');
    return asset.file.text();
  }
  const file = new File(asset.uri);
  if ((asset.size ?? file.size) > MAX_DOCUMENT_BYTES)
    throw new Error('Choose a document no larger than 20 MB');
  return file.text();
}

export async function shareTextFile(content: string, format: 'csv' | 'json'): Promise<void> {
  const filename = `expense-split-${randomUUID()}.${format}`;
  if (Platform.OS === 'web') {
    if (typeof document === 'undefined') throw new Error('File export requires a browser');
    const url = URL.createObjectURL(
      new Blob([content], {
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is not available on this device');
  const file = new File(Paths.cache, filename);
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, {
    mimeType: format === 'csv' ? 'text/csv' : 'application/json',
    dialogTitle: 'Export Expense Split',
    UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'public.json',
  });
}
