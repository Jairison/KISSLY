import { StyleSheet, Text, View } from 'react-native';

import { ChoiceList } from '@/components/ui/ChipGroup';
import { Slider } from '@/components/ui/Slider';
import { SHOW_ME_OPTIONS } from '@/data/catalog';
import { colors, fonts, radii, spacing } from '@/theme';
import { AGE_LIMITS, DISTANCE_LIMITS, type DiscoveryPrefs, type ShowMe } from '@/types/user';

type Props = {
  prefs: DiscoveryPrefs;
  onChange: (prefs: DiscoveryPrefs) => void;
  /** Mostra também "Quem você quer conhecer" (não aparece no onboarding, que já perguntou isso). */
  showMe?: ShowMe;
  onShowMeChange?: (value: ShowMe) => void;
};

export function DiscoveryFilters({ prefs, onChange, showMe, onShowMeChange }: Props) {
  const unlimited = prefs.maxDistanceKm === null;
  const distance = prefs.maxDistanceKm ?? DISTANCE_LIMITS.max;
  const ageMaxLabel = prefs.ageMax >= AGE_LIMITS.max ? `${AGE_LIMITS.max}+` : prefs.ageMax;

  return (
    <View style={{ gap: spacing.lg }}>
      {showMe && onShowMeChange && (
        <Card title="Mostrar">
          <ChoiceList options={SHOW_ME_OPTIONS} value={showMe} onChange={onShowMeChange} />
        </Card>
      )}

      <Card title="Faixa de idade" value={`${prefs.ageMin} – ${ageMaxLabel}`}>
        <Slider
          min={AGE_LIMITS.min}
          max={AGE_LIMITS.max}
          low={prefs.ageMin}
          high={prefs.ageMax}
          onChange={(ageMin, ageMax) => onChange({ ...prefs, ageMin, ageMax: ageMax ?? prefs.ageMax })}
        />
      </Card>

      <Card title="Distância máxima" value={unlimited ? 'Sem limite' : `${distance} km`}>
        <Slider
          min={DISTANCE_LIMITS.min}
          max={DISTANCE_LIMITS.max}
          low={distance}
          onChange={(km) => onChange({ ...prefs, maxDistanceKm: km >= DISTANCE_LIMITS.max ? null : km })}
        />
        <Text style={styles.note}>
          Vale para o modo Estadual. No Nacional e no Internacional você vê pessoas de qualquer distância.
        </Text>
      </Card>
    </View>
  );
}

function Card({ title, value, children }: { title: string; value?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {value && <Text style={styles.cardValue}>{value}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  cardValue: { fontFamily: fonts.semibold, fontSize: 16, color: colors.rose },
  note: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textFaint },
});
