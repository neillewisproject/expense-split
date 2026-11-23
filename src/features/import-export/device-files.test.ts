import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { pickTextFile } from './device-files';

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: class {
    size = 20_000_000;
    text() {
      return Promise.resolve('{"backup":true}');
    }
  },
  Paths: {},
}));
jest.mock('expo-sharing', () => ({}));

it('reads a backup at the document limit and rejects a larger file before reading', async () => {
  const text = jest.spyOn(File.prototype, 'text');
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///backup.json', name: 'backup.json', size: 20_000_000, lastModified: 0 },
    ],
  });
  await expect(pickTextFile()).resolves.toBe('{"backup":true}');
  expect(text).toHaveBeenCalledTimes(1);
  text.mockClear();
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: [
      { uri: 'file:///backup.json', name: 'backup.json', size: 20_000_001, lastModified: 0 },
    ],
  });
  await expect(pickTextFile()).rejects.toThrow('no larger than 20 MB');
  expect(text).not.toHaveBeenCalled();
});
