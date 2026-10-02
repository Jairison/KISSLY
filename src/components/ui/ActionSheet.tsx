import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radii, spacing } from '@/theme';

export type SheetAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: SheetAction[];
};

/** Menu que sobe da parte de baixo da tela (funciona igual no iOS, Android e web). */
export function ActionSheet({ visible, onClose, title, message, actions }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceRaised }]}
              onPress={action.onPress}
            >
              <Ionicons name={action.icon} size={20} color={action.destructive ? colors.danger : colors.text} />
              <Text style={[styles.actionText, action.destructive && { color: colors.danger }]}>{action.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
    marginBottom: spacing.md,
  },
  title: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text, textAlign: 'center' },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    borderRadius: radii.md,
  },
  actionText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  cancel: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  cancelText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
});
