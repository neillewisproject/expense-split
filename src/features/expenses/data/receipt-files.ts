import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const receiptDirectory = new Directory(Paths.document, 'receipts');
const receiptDirectoryPrefix = `${receiptDirectory.uri.replace(/\/+$/, '')}/`;

export async function persistReceiptFile(uri: string): Promise<string> {
  receiptDirectory.create({ idempotent: true, intermediates: true });

  const source = new File(uri);
  const extension = /^\.[a-zA-Z0-9]+$/.test(source.extension) ? source.extension : '.jpg';
  const destination = new File(receiptDirectory, `${randomUUID()}${extension}`);
  await source.copy(destination);
  return destination.uri;
}

export function deleteReceiptFile(uri: string): void {
  if (!uri.startsWith(receiptDirectoryPrefix)) return;

  const file = new File(uri);
  if (file.exists) file.delete();
}
