import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import { ReceiptPicker } from './receipt-picker';

jest.mock('expo-image-picker', () => ({
  PermissionStatus: { DENIED: 'denied' },
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/features/expenses/data/receipt-files', () => ({ persistReceiptFile: jest.fn() }));

it('keeps existing receipts and surfaces denied camera access', async () => {
  jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
    granted: false,
    canAskAgain: false,
    expires: 'never',
    status: ImagePicker.PermissionStatus.DENIED,
  });
  const onChange = jest.fn();
  await render(<ReceiptPicker uris={['file:///existing.jpg']} onChange={onChange} />);
  fireEvent.press(screen.getByText('Photograph receipt'));
  expect(
    await screen.findByText('Camera access was denied. You can still choose a photo.'),
  ).toBeTruthy();
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(onChange).not.toHaveBeenCalled();
});
