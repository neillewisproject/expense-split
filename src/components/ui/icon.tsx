import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

const ICONS = {
  home: { ios: 'house.fill', android: 'home' },
  activity: { ios: 'list.bullet.rectangle.portrait', android: 'receipt_long' },
  groups: { ios: 'person.3.fill', android: 'groups' },
  insights: { ios: 'chart.pie.fill', android: 'pie_chart' },
  more: { ios: 'ellipsis.circle', android: 'more_horiz' },
  add: { ios: 'plus', android: 'add' },
  search: { ios: 'magnifyingglass', android: 'search' },
  filter: { ios: 'slider.horizontal.3', android: 'tune' },
  trash: { ios: 'trash', android: 'delete' },
  restore: { ios: 'arrow.uturn.backward', android: 'restore_from_trash' },
  select: { ios: 'checklist', android: 'checklist' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
  close: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  checked: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  unchecked: { ios: 'circle', android: 'radio_button_unchecked' },
  wallet: { ios: 'creditcard.fill', android: 'account_balance_wallet' },
  budget: { ios: 'gauge.with.needle', android: 'speed' },
  report: { ios: 'chart.bar.fill', android: 'bar_chart' },
  breakdown: { ios: 'chart.pie', android: 'donut_large' },
  recurring: { ios: 'repeat', android: 'repeat' },
  transfer: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  importExport: { ios: 'arrow.up.arrow.down', android: 'import_export' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  lock: { ios: 'lock.fill', android: 'lock' },
  cloud: { ios: 'icloud.fill', android: 'cloud' },
  person: { ios: 'person.crop.circle.fill', android: 'account_circle' },
  people: { ios: 'person.2.fill', android: 'people' },
  signOut: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  signIn: { ios: 'person.badge.key.fill', android: 'login' },
  receipt: { ios: 'doc.text.image', android: 'receipt' },
  income: { ios: 'arrow.down.left', android: 'south_west' },
  expense: { ios: 'arrow.up.right', android: 'north_east' },
  refund: { ios: 'arrow.uturn.left', android: 'undo' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  info: { ios: 'info.circle.fill', android: 'info' },
  error: { ios: 'exclamationmark.circle.fill', android: 'error' },
  sync: { ios: 'arrow.triangle.2.circlepath', android: 'sync' },
  settle: { ios: 'arrow.left.arrow.right.circle.fill', android: 'handshake' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  photos: { ios: 'photo.on.rectangle', android: 'photo_library' },
  calendar: { ios: 'calendar', android: 'calendar_today' },
  edit: { ios: 'pencil', android: 'edit' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  food: { ios: 'fork.knife', android: 'restaurant' },
  transport: { ios: 'car.fill', android: 'directions_car' },
  shopping: { ios: 'bag.fill', android: 'shopping_bag' },
  bills: { ios: 'bolt.fill', android: 'bolt' },
  entertainment: { ios: 'film.fill', android: 'movie' },
  category: { ios: 'square.grid.2x2.fill', android: 'category' },
  tag: { ios: 'tag.fill', android: 'sell' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const symbol = ICONS[name];
  return (
    <SymbolView
      name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }}
      size={size}
      tintColor={color ?? theme.text}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
