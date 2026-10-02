import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { noWebOutline } from '@/components/ui/TextField';
import { colors, fonts, radii, spacing } from '@/theme';
import { ageFromBirthdate } from '@/types/user';

type Props = {
  /** AAAA-MM-DD ou "" */
  value: string;
  onChange: (iso: string) => void;
};

export type BirthdateCheck = { ok: true; age: number } | { ok: false; message: string | null };

/** Valida a data e exige 18+ anos. */
export function checkBirthdate(iso: string): BirthdateCheck {
  if (!iso) return { ok: false, message: null };
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const valid = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!valid) return { ok: false, message: 'Data inválida' };
  const age = ageFromBirthdate(iso);
  if (age < 18) return { ok: false, message: 'O Kissly é exclusivo para maiores de 18 anos' };
  if (age > 100) return { ok: false, message: 'Confira o ano de nascimento' };
  return { ok: true, age };
}

export function BirthdateInput({ value, onChange }: Props) {
  const [y = '', m = '', d = ''] = value ? value.split('-') : [];
  const [parts, setParts] = useState({ d, m, y });
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const update = (key: 'd' | 'm' | 'y', text: string) => {
    const digits = text.replace(/\D/g, '');
    const next = { ...parts, [key]: digits };
    setParts(next);
    if (key === 'd' && digits.length === 2) monthRef.current?.focus();
    if (key === 'm' && digits.length === 2) yearRef.current?.focus();
    const complete = next.d.length >= 1 && next.m.length >= 1 && next.y.length === 4;
    onChange(complete ? `${next.y}-${next.m.padStart(2, '0')}-${next.d.padStart(2, '0')}` : '');
  };

  const check = checkBirthdate(value);

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.row}>
        <Segment label="Dia" placeholder="DD" value={parts.d} maxLength={2} onChangeText={(t) => update('d', t)} autoFocus />
        <Segment ref={monthRef} label="Mês" placeholder="MM" value={parts.m} maxLength={2} onChangeText={(t) => update('m', t)} />
        <Segment ref={yearRef} label="Ano" placeholder="AAAA" value={parts.y} maxLength={4} onChangeText={(t) => update('y', t)} wide />
      </View>
      {check.ok ? (
        <Text style={styles.age}>Você tem {check.age} anos</Text>
      ) : check.message ? (
        <Text style={styles.error}>{check.message}</Text>
      ) : null}
    </View>
  );
}

type SegmentProps = {
  ref?: React.Ref<TextInput>;
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  onChangeText: (t: string) => void;
  autoFocus?: boolean;
  wide?: boolean;
};

function Segment({ ref, label, wide, ...input }: SegmentProps) {
  return (
    <View style={[styles.segment, wide && { flex: 1.6 }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        {...input}
        keyboardType="number-pad"
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.rose}
        style={[styles.input, noWebOutline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  segment: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.textFaint },
  input: { fontFamily: fonts.semibold, fontSize: 24, color: colors.text, paddingVertical: 4 },
  age: { fontFamily: fonts.medium, fontSize: 15, color: colors.gold },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger },
});
