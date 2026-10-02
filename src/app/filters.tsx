import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { DiscoveryFilters } from '@/components/profile/DiscoveryFilters';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useCurrentUser, useSession } from '@/state/Session';
import { colors, fonts, spacing } from '@/theme';
import { DEFAULT_PREFS } from '@/types/user';

export default function FiltersScreen() {
  const user = useCurrentUser();
  const { prefs: saved, updatePrefs, updateProfile } = useSession();
  const { show } = useToast();
  const [prefs, setPrefs] = useState(saved);
  const [showMe, setShowMe] = useState(user.showMe);
  const [saving, setSaving] = useState(false);

  const apply = async () => {
    setSaving(true);
    try {
      await updatePrefs(prefs);
      if (showMe !== user.showMe) await updateProfile({ showMe });
      router.back();
    } catch {
      show('Não foi possível salvar. Tente de novo.', 'alert-circle', colors.danger);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        mode="close"
        title="Preferências"
        right={
          <Text style={styles.reset} onPress={() => setPrefs(DEFAULT_PREFS)}>
            Redefinir
          </Text>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <DiscoveryFilters prefs={prefs} onChange={setPrefs} showMe={showMe} onShowMeChange={setShowMe} />
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Aplicar filtros" onPress={apply} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  reset: { fontFamily: fonts.semibold, fontSize: 14, color: colors.rose },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
