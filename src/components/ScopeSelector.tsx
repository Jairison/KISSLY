import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { DiscoveryScope } from '@/data/profiles';
import { colors, fonts, radii } from '@/theme';

const OPTIONS: { key: DiscoveryScope; label: string; premium?: boolean }[] = [
  { key: 'state', label: 'Estadual' },
  { key: 'national', label: 'Nacional' },
  { key: 'international', label: 'Internacional', premium: true },
];

type Props = {
  value: DiscoveryScope;
  onChange: (scope: DiscoveryScope) => void;
  /** Se falso, opções premium aparecem com cadeado. */
  hasPremium: boolean;
};

export function ScopeSelector({ value, onChange, hasPremium }: Props) {
  return (
    <View style={styles.track}>
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        const locked = opt.premium && !hasPremium;
        return (
          <Pressable key={opt.key} onPress={() => onChange(opt.key)} style={[styles.option, active && styles.active]}>
            {opt.premium && (
              <Ionicons name={locked ? 'lock-closed' : 'globe-outline'} size={12} color={active ? colors.background : colors.gold} />
            )}
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  active: { backgroundColor: colors.text },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  labelActive: { color: colors.background },
});
