import { NativeTabs } from 'expo-router/native-tabs';

import { tabSymbol } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

const TABS = [
  { name: 'index', label: 'Home', icon: tabSymbol('home') },
  { name: 'activity', label: 'Activity', icon: tabSymbol('activity') },
  { name: 'groups', label: 'Groups', icon: tabSymbol('groups') },
  { name: 'insights', label: 'Insights', icon: tabSymbol('insights') },
  { name: 'more', label: 'More', icon: tabSymbol('more') },
] as const;

export default function AppTabs() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.card}
      indicatorColor={theme.accentSoft}
      tintColor={theme.accent}
      iconColor={{ default: theme.textSecondary, selected: theme.accent }}
      labelStyle={{
        default: { color: theme.textSecondary },
        selected: { color: theme.accent, fontWeight: '600' },
      }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.icon.sf} md={tab.icon.md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
