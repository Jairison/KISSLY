import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { BRAZIL_STATES, toUF } from '@/data/catalog';
import { colors, fonts, radii, spacing } from '@/theme';

/** lat/lng vêm do GPS; ao digitar a cidade à mão elas são descartadas. */
export type PlaceValue = { city: string; state: string; country: string; lat: number | null; lng: number | null };

type Props = {
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
};

export function LocationPicker({ value, onChange }: Props) {
  const [detecting, setDetecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const abroad = value.country !== 'Brasil';

  const detect = async () => {
    setDetecting(true);
    setMessage(null);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setMessage('Sem permissão de localização. Preencha manualmente abaixo.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(position.coords);
      if (!place) throw new Error('sem endereço');

      const isBrazil = place.isoCountryCode === 'BR';
      onChange({
        city: place.city ?? place.subregion ?? '',
        state: (isBrazil ? toUF(place.region) : place.region) ?? '',
        country: isBrazil ? 'Brasil' : (place.country ?? ''),
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setMessage('Localização encontrada ✓');
    } catch {
      setMessage('Não conseguimos detectar sua cidade. Preencha manualmente abaixo.');
    } finally {
      setDetecting(false);
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Button title="Usar minha localização" icon="navigate" variant="outline" loading={detecting} onPress={detect} />
      {message && <Text style={styles.message}>{message}</Text>}

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>ou informe</Text>
        <View style={styles.line} />
      </View>

      <TextField
        label="Cidade"
        icon="business-outline"
        placeholder="Ex.: São Paulo"
        value={value.city}
        onChangeText={(city) => onChange({ ...value, city, lat: null, lng: null })}
        autoCapitalize="words"
      />

      {abroad ? (
        <View style={styles.abroad}>
          <Ionicons name="globe-outline" size={18} color={colors.gold} />
          <Text style={styles.abroadText}>
            {value.state ? `${value.state}, ` : ''}
            {value.country}
          </Text>
          <Pressable onPress={() => onChange({ city: '', state: '', country: 'Brasil', lat: null, lng: null })}>
            <Text style={styles.link}>Estou no Brasil</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Estado</Text>
          <View style={styles.ufGrid}>
            {BRAZIL_STATES.map((s) => {
              const active = s.uf === value.state;
              return (
                <Pressable
                  key={s.uf}
                  onPress={() => onChange({ ...value, state: s.uf, lat: null, lng: null })}
                  style={[styles.uf, active && styles.ufActive]}
                >
                  <Text style={[styles.ufText, active && styles.ufTextActive]}>{s.uf}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  message: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginLeft: 4 },
  ufGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  uf: {
    width: 50,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ufActive: { borderColor: colors.rose, backgroundColor: 'rgba(255,61,127,0.12)' },
  ufText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  ufTextActive: { color: colors.text },
  abroad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  abroadText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  link: { fontFamily: fonts.semibold, fontSize: 13, color: colors.rose },
});
