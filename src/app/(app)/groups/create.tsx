import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useGroupsStore } from '@/features/groups/store';
import { useAuth } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';

export default function CreateGroupScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const createGroup = useGroupsStore((state) => state.createGroup);
  const [name, setName] = useState('');
  const [yourName, setYourName] = useState('');
  const [otherMembers, setOtherMembers] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreateGroup() {
    setError(null);
    setIsSaving(true);
    try {
      const memberNames = [yourName, ...otherMembers.split(/[\n,]/)];
      const groupId = await createGroup(name, memberNames, user?.id, currency.trim().toUpperCase());
      router.replace({ pathname: '/groups/[id]', params: { id: groupId } });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create this group.');
    } finally {
      setIsSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">New group</ThemedText>
          <View style={styles.headerSpacer} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAvoidingView}>
          <ScrollView
            contentContainerStyle={styles.form}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <ThemedText type="smallBold">Fixed base currency (ISO code)</ThemedText>
              <TextInput
                accessibilityLabel="Group base currency"
                autoCapitalize="characters"
                value={currency}
                onChangeText={setCurrency}
                style={inputStyle}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="smallBold">Group name</ThemedText>
              <TextInput
                accessibilityLabel="Group name"
                autoCapitalize="words"
                onChangeText={setName}
                placeholder="e.g. Goa trip"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
                value={name}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="smallBold">Your name</ThemedText>
              <TextInput
                accessibilityLabel="Your name"
                autoCapitalize="words"
                onChangeText={setYourName}
                placeholder="e.g. Neill"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
                value={yourName}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="smallBold">Other members</ThemedText>
              <TextInput
                accessibilityLabel="Other members"
                autoCapitalize="words"
                multiline
                onChangeText={setOtherMembers}
                placeholder={'One name per line, for example:\nAsha\nBen'}
                placeholderTextColor={theme.textSecondary}
                style={[inputStyle, styles.membersInput]}
                value={otherMembers}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Separate names with a new line or comma.
              </ThemedText>
            </View>
            {error ? (
              <ThemedText accessibilityRole="alert" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void handleCreateGroup()}
              style={[styles.submitButton, isSaving && styles.disabledButton]}>
              <ThemedText style={styles.submitButtonText}>
                {isSaving ? 'Creating…' : 'Create group'}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  headerSpacer: {
    width: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  form: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  membersInput: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  error: {
    color: '#b42318',
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: Spacing.three,
    backgroundColor: '#3c87f7',
    padding: Spacing.three,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
});
