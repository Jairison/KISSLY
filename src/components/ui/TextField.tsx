import { useState, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radii, spacing } from '@/theme';

type Props = TextInputProps & {
  ref?: Ref<TextInput>;
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Mostra o botão de olho para revelar a senha. */
  password?: boolean;
  /** Mostra contador "x/max" (requer maxLength). */
  counter?: boolean;
};

export function TextField({ ref, label, error, hint, icon, password, counter, style, multiline, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const length = input.value?.length ?? 0;

  return (
    <View style={styles.wrap}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.box,
          multiline && styles.boxMultiline,
          focused && styles.boxFocused,
          !!error && styles.boxError,
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={focused ? colors.rose : colors.textFaint} />}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.rose}
          secureTextEntry={password && hidden}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, noWebOutline, style]}
        />
        {password && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <View style={styles.footer}>
        <Text style={[styles.hint, !!error && { color: colors.danger }]}>{error || hint || ''}</Text>
        {counter && input.maxLength ? (
          <Text style={styles.hint}>
            {length}/{input.maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** No navegador, o campo já tem borda própria; tira o contorno padrão de foco. */
export const noWebOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginLeft: 4 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  boxMultiline: { alignItems: 'flex-start', paddingVertical: spacing.md },
  boxFocused: { borderColor: colors.rose, backgroundColor: colors.surfaceRaised },
  boxError: { borderColor: colors.danger },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, paddingVertical: 14 },
  inputMultiline: { minHeight: 110, paddingVertical: 4, lineHeight: 22 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, minHeight: 16 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
});
