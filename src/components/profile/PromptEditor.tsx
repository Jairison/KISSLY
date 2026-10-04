import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { noWebOutline } from '@/components/ui/TextField';
import { PROMPT_LIMITS, PROMPT_QUESTIONS } from '@/data/prompts';
import { colors, fonts, radii, spacing } from '@/theme';
import type { ProfilePrompt } from '@/types/user';

type Props = {
  prompts: ProfilePrompt[];
  onChange: (prompts: ProfilePrompt[]) => void;
};

/** Até 3 perguntas: escolhe na lista e responde do seu jeito. */
export function PromptEditor({ prompts, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  const insets = useSafeAreaInsets();
  const used = new Set(prompts.map((p) => p.question));

  const update = (index: number, answer: string) =>
    onChange(prompts.map((p, i) => (i === index ? { ...p, answer } : p)));

  return (
    <View style={{ gap: spacing.md }}>
      {prompts.map((prompt, index) => (
        <View key={prompt.question} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.question}>{prompt.question}</Text>
            <Pressable
              onPress={() => onChange(prompts.filter((_, i) => i !== index))}
              hitSlop={10}
              accessibilityLabel={`Remover a pergunta ${prompt.question}`}
            >
              <Ionicons name="close-circle" size={22} color={colors.textFaint} />
            </Pressable>
          </View>
          <TextInput
            value={prompt.answer}
            onChangeText={(text) => update(index, text)}
            placeholder="Sua resposta…"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.rose}
            multiline
            maxLength={PROMPT_LIMITS.answerMax}
            style={[styles.answer, noWebOutline]}
          />
          <Text style={styles.counter}>
            {prompt.answer.length}/{PROMPT_LIMITS.answerMax}
          </Text>
        </View>
      ))}

      {prompts.length < PROMPT_LIMITS.max && (
        <Pressable style={styles.add} onPress={() => setPicking(true)}>
          <Ionicons name="add-circle" size={22} color={colors.rose} />
          <Text style={styles.addText}>
            {prompts.length === 0 ? 'Escolher uma pergunta' : 'Adicionar outra pergunta'}
          </Text>
        </Pressable>
      )}

      <Modal visible={picking} transparent animationType="fade" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Escolha uma pergunta</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {PROMPT_QUESTIONS.filter((q) => !used.has(q)).map((question) => (
                <Pressable
                  key={question}
                  style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceRaised }]}
                  onPress={() => {
                    onChange([...prompts, { question, answer: '' }]);
                    setPicking(false);
                  }}
                >
                  <Text style={styles.optionText}>{question}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/** Mantém só as perguntas respondidas (com o texto aparado), prontas para salvar. */
export const cleanPrompts = (prompts: ProfilePrompt[]) =>
  prompts.map((p) => ({ question: p.question, answer: p.answer.trim() })).filter((p) => p.answer.length > 0);

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  question: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.rose },
  answer: {
    minHeight: 60,
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    textAlignVertical: 'top',
    padding: 0,
  },
  counter: { alignSelf: 'flex-end', fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,61,127,0.4)',
  },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.rose },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textFaint,
    marginBottom: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    borderRadius: radii.md,
  },
  optionText: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text },
});
