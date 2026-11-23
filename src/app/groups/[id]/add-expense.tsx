import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { parseAmount } from '@/features/expenses/domain/money';
import { splitByShares, splitEqually } from '@/features/expenses/domain/split';
import { useGroupsStore } from '@/features/groups/store';
import { useTheme } from '@/hooks/use-theme';
import { triggerSuccessHaptic } from '@/lib/success-haptics';

type SplitMode = 'equally' | 'shares';

function getTodayDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function AddGroupExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const group = useGroupsStore((state) => state.groups.find((item) => item.id === id));
  const status = useGroupsStore((state) => state.status);
  const loadGroups = useGroupsStore((state) => state.loadGroups);
  const addGroupExpense = useGroupsStore((state) => state.addGroupExpense);
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(getTodayDate);
  const [paidBy, setPaidBy] = useState('');
  const [splitMode, setSplitMode] = useState<SplitMode>('equally');
  const [shares, setShares] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!group && status === 'idle') void loadGroups();
  }, [group, loadGroups, status]);

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.backgroundSelected }];

  async function handleSave() {
    if (!group) return;
    setError(null);
    const descriptionValue = description.trim();
    const amount = parseAmount(amountText);
    const payer = paidBy || group.members[0]?.id;
    const dateValue = new Date(`${date}T00:00:00.000Z`);
    if (!descriptionValue) {
      setError('Enter an expense description.');
      return;
    }
    if (amount === null || !Number.isSafeInteger(amount) || amount <= 0) {
      setError('Enter an amount greater than zero with up to 2 decimal places.');
      return;
    }
    if (Number.isNaN(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date) {
      setError('Enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (!payer) {
      setError('Choose who paid for this expense.');
      return;
    }

    let split: Record<string, number>;
    try {
      if (splitMode === 'equally') {
        split = splitEqually(
          amount,
          group.members.map((member) => member.id),
        );
      } else {
        const parsedShares: Record<string, number> = {};
        for (const member of group.members) {
          const value = shares[member.id]?.trim() ?? '';
          const share = value === '' ? 0 : Number(value);
          if (!Number.isFinite(share) || share < 0) {
            setError(`Enter a valid non-negative share for ${member.name}.`);
            return;
          }
          parsedShares[member.id] = share;
        }
        split = splitByShares(amount, parsedShares);
      }
    } catch (splitError) {
      setError(splitError instanceof Error ? splitError.message : 'Could not split this expense.');
      return;
    }

    setIsSaving(true);
    try {
      await addGroupExpense(id, {
        description: descriptionValue,
        amount,
        paidBy: payer,
        split,
        date,
        kind: 'expense',
      });
      triggerSuccessHaptic();
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this expense.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!group) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">
            {status === 'idle' || status === 'loading' ? 'Loading group…' : 'Group not found'}
          </ThemedText>
          {status === 'ready' || status === 'error' ? (
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <ThemedText type="linkPrimary">Go back</ThemedText>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </ThemedView>
    );
  }

  const selectedPayer = paidBy || group.members[0]?.id || '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <ThemedText type="linkPrimary">Cancel</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Add group expense</ThemedText>
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
              <ThemedText type="smallBold">Description</ThemedText>
              <TextInput
                accessibilityLabel="Description"
                autoCapitalize="sentences"
                onChangeText={setDescription}
                placeholder="e.g. Dinner"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
                value={description}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="smallBold">Amount (₹)</ThemedText>
              <TextInput
                accessibilityLabel="Amount"
                keyboardType="decimal-pad"
                onChangeText={setAmountText}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
                value={amountText}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="smallBold">Date</ThemedText>
              <TextInput
                accessibilityLabel="Date"
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textSecondary}
                style={inputStyle}
                value={date}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Paid by</ThemedText>
              <View style={styles.options}>
                {group.members.map((member) => {
                  const selected = selectedPayer === member.id;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={member.id}
                      onPress={() => setPaidBy(member.id)}
                      style={[
                        styles.option,
                        {
                          backgroundColor: selected ? '#3c87f7' : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText style={selected ? styles.selectedOptionText : undefined}>
                        {member.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">Split</ThemedText>
              <View style={styles.options}>
                {(['equally', 'shares'] as const).map((mode) => {
                  const selected = splitMode === mode;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      key={mode}
                      onPress={() => setSplitMode(mode)}
                      style={[
                        styles.option,
                        {
                          backgroundColor: selected ? '#3c87f7' : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText style={selected ? styles.selectedOptionText : undefined}>
                        {mode === 'equally' ? 'Equally' : 'By shares'}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              {splitMode === 'equally' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  The total is divided between all {group.members.length} members.
                </ThemedText>
              ) : (
                <View style={styles.shares}>
                  {group.members.map((member) => (
                    <View key={member.id} style={styles.shareRow}>
                      <ThemedText type="small">{member.name}</ThemedText>
                      <TextInput
                        accessibilityLabel={`${member.name} shares`}
                        keyboardType="decimal-pad"
                        onChangeText={(value) =>
                          setShares((current) => ({ ...current, [member.id]: value }))
                        }
                        placeholder="1"
                        placeholderTextColor={theme.textSecondary}
                        style={[inputStyle, styles.shareInput]}
                        value={shares[member.id] ?? '1'}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {error ? (
              <ThemedText accessibilityRole="alert" style={styles.error}>
                {error}
              </ThemedText>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void handleSave()}
              style={[styles.submitButton, isSaving && styles.disabledButton]}>
              <ThemedText style={styles.submitButtonText}>
                {isSaving ? 'Saving…' : 'Save expense'}
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
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  selectedOptionText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  shares: {
    gap: Spacing.two,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  shareInput: {
    width: 112,
    textAlign: 'right',
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
