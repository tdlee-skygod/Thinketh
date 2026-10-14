import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useGoalEntryStore } from '@/store/useGoalEntryStore';
import { GoalLogModal } from '@/components/goal/GoalLogModal';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import type { Goal } from '@/types';

interface GoalListItemProps {
  goal: Goal;
  isEditing: boolean;
  onEdit: (goal: Goal) => void;
}

export function GoalListItem({ goal, isEditing, onEdit }: GoalListItemProps) {
  const entryCount = useGoalEntryStore((s) => s.entryCounts[goal.id] ?? 0);
  const [modalMode, setModalMode] = useState<'commitment' | 'aspiration' | null>(null);

  return (
    <View style={[styles.card, isEditing && styles.cardEditing]}>
      <View style={styles.row}>
        <Pressable style={styles.textPressable} onPress={() => onEdit(goal)} hitSlop={4}>
          <Text style={styles.text}>{goal.text}</Text>
        </Pressable>
        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => setModalMode('commitment')}>
            <Text style={styles.actionText}>다짐</Text>
          </Pressable>
          <Pressable onPress={() => setModalMode('commitment')} hitSlop={6}>
            <Text style={styles.count}>{entryCount}건</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => setModalMode('aspiration')}>
            <Text style={styles.actionText}>열망</Text>
          </Pressable>
        </View>
      </View>

      {modalMode && (
        <GoalLogModal
          visible={!!modalMode}
          mode={modalMode}
          goalId={goal.id}
          goalText={goal.text}
          onClose={() => setModalMode(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardEditing: { borderColor: COLORS.primary, borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm },
  textPressable: { flex: 1 },
  text: { fontSize: FONT.size.lg, fontWeight: FONT.weight.semibold, color: COLORS.textDark, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.bgLight,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  actionText: { fontSize: FONT.size.sm, fontWeight: FONT.weight.bold, color: COLORS.primary },
  count: { fontSize: FONT.size.sm, color: COLORS.textMuted, fontWeight: FONT.weight.semibold },
});
