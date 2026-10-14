import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { COLORS, SPACING, RADIUS, FONT } from '@/constants/theme';
import type { GoalCategory } from '@/types';

interface CategorySelectProps {
  categories: GoalCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategorySelect({ categories, selectedId, onSelect }: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((c) => c.id === selectedId);

  return (
    <>
      <Pressable style={styles.box} onPress={() => setOpen(true)}>
        <Text style={styles.boxText} numberOfLines={1}>
          {selected?.name ?? '카테고리 선택'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <FlatList
              data={categories}
              keyExtractor={(c) => c.id}
              ListEmptyComponent={<Text style={styles.empty}>등록된 카테고리가 없어요</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, item.id === selectedId && styles.optionActive]}
                  onPress={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item.id === selectedId && styles.optionTextActive]}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  boxText: { flex: 1, fontSize: FONT.size.lg, color: COLORS.textDark, fontWeight: FONT.weight.semibold },
  chevron: { color: COLORS.primaryLight, fontSize: FONT.size.md, marginLeft: SPACING.sm },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,27,75,0.4)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    maxHeight: '60%',
    paddingVertical: SPACING.sm,
  },
  empty: { textAlign: 'center', color: COLORS.textMuted, padding: SPACING.xl },
  option: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg },
  optionActive: { backgroundColor: COLORS.bgLight },
  optionText: { fontSize: FONT.size.lg, color: COLORS.textDark },
  optionTextActive: { color: COLORS.primary, fontWeight: FONT.weight.bold },
});
