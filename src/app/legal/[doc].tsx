import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { LEGAL_DOCS, LEGAL_UPDATED_AT, type LegalDocId } from '@/data/legal';
import { colors, fonts, spacing } from '@/theme';

/** Termos de Uso, Política de Privacidade e Dicas de segurança. Acessível com ou sem login. */
export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: LegalDocId }>();
  const content = LEGAL_DOCS[doc] ?? LEGAL_DOCS.terms;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title={content.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Atualizado em {LEGAL_UPDATED_AT}</Text>
        <Text style={styles.intro}>{content.intro}</Text>
        {content.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing.xxl },
  updated: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint },
  intro: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  section: { gap: spacing.sm },
  heading: { fontFamily: fonts.semibold, fontSize: 17, color: colors.rose, marginTop: spacing.sm },
  paragraph: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23, color: colors.textMuted },
});
