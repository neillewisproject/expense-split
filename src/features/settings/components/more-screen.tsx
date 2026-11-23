import { router, type Href } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  Avatar,
  Button,
  Card,
  Divider,
  IconBadge,
  ListRow,
  Screen,
  ScreenHeader,
  SectionHeader,
  type IconName,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';

type Item = { title: string; subtitle: string; icon: IconName; route: Href };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Money',
    items: [
      {
        title: 'Accounts',
        subtitle: 'Cash, bank and card balances',
        icon: 'wallet',
        route: '/accounts',
      },
      {
        title: 'Recurring',
        subtitle: 'Schedules and drafts to approve',
        icon: 'recurring',
        route: '/recurring',
      },
      {
        title: 'People',
        subtitle: 'Two-person balances across groups',
        icon: 'people',
        route: '/groups/people',
      },
    ],
  },
  {
    title: 'Preferences',
    items: [
      {
        title: 'Categories & rules',
        subtitle: 'Default currency, custom categories, auto-suggest',
        icon: 'category',
        route: '/personal-settings',
      },
      {
        title: 'Privacy & app lock',
        subtitle: 'Device authentication and data controls',
        icon: 'lock',
        route: '/privacy',
      },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        title: 'Import & export',
        subtitle: 'CSV, JSON backups and restore',
        icon: 'importExport',
        route: '/import-export',
      },
      {
        title: 'Cloud backup',
        subtitle: 'Private backup stored in your account',
        icon: 'cloud',
        route: '/personal-cloud',
      },
    ],
  },
];

export function MoreScreen() {
  const { user, isConfigured, signOut } = useAuth();

  function confirmSignOut() {
    Alert.alert('Sign out?', 'Shared groups will be hidden until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut().catch((error: unknown) => {
            Alert.alert(
              'Could not sign out',
              error instanceof Error ? error.message : 'Please try again.',
            );
          });
        },
      },
    ]);
  }

  return (
    <Screen tabBar header={<ScreenHeader large title="More" />}>
      <Card>
        <View style={styles.profile}>
          {user?.email ? (
            <Avatar name={user.email} size={48} />
          ) : (
            <IconBadge icon="person" size={48} />
          )}
          <View style={styles.profileText}>
            <ThemedText type="heading" numberOfLines={1}>
              {user?.email ?? 'Using this device only'}
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {user
                ? 'Signed in · shared groups sync across devices'
                : 'Sign in to share groups and back up to the cloud'}
            </ThemedText>
          </View>
        </View>
        {user ? (
          <Button variant="danger" icon="signOut" label="Sign out" onPress={confirmSignOut} />
        ) : (
          <Button
            icon="signIn"
            label="Sign in"
            disabled={!isConfigured}
            onPress={() => router.push('/sign-in')}
          />
        )}
      </Card>

      {SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <SectionHeader title={section.title} />
          <Card padded={false}>
            {section.items.map((item, index) => (
              <View key={item.title}>
                {index ? <Divider /> : null}
                <ListRow
                  title={item.title}
                  subtitle={item.subtitle}
                  icon={item.icon}
                  onPress={() => router.push(item.route)}
                />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  profileText: { flex: 1, minWidth: 0, gap: 2 },
  section: { gap: Spacing.two },
});
