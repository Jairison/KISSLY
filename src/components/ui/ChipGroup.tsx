import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, fonts, radii, spacing } from '@/theme';

type Option<T extends string> = { value: T; label: string };

type SingleProps<T extends string> = {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Botões grandes empilhados, para escolhas principais (ex.: gênero). */
  large?: boolean;
};

export function ChoiceList<T extends string>({ options, value, onChange, large }: SingleProps<T>) {
  return (
    <View style={large ? styles.column : styles.wrap}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(opt.value);
            }}
            style={[large ? styles.large : styles.chip, active && styles.active]}
          >
            <Text style={[large ? styles.largeText : styles.chipText, active && styles.activeText]}>{opt.label}</Text>
            {large && (
              <Ionicons
                name={active ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={active ? colors.rose : colors.textFaint}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type MultiProps = {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  max: number;
  onLimit?: () => void;
};

export function MultiChips({ options, value, onChange, max, onLimit }: MultiProps) {
  const toggle = (item: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (value.includes(item)) return onChange(value.filter((v) => v !== item));
    if (value.length >= max) return onLimit?.();
    onChange([...value, item]);
  };

  return (
    <View style={styles.wrap}>
      {options.map((item) => {
        const active = value.includes(item);
        return (
          <Pressable key={item} onPress={() => toggle(item)} style={[styles.chip, active && styles.active]}>
            {active && <Ionicons name="checkmark" size={14} color={colors.rose} />}
            <Text style={[styles.chipText, active && styles.activeText]}>{item}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  column: { gap: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: 18,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  largeText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  active: { borderColor: colors.rose, backgroundColor: 'rgba(255,61,127,0.12)' },
  activeText: { color: colors.text },
});
