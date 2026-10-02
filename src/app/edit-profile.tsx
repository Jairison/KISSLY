import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { LocationPicker } from '@/components/profile/LocationPicker';
import { PhotoGrid } from '@/components/profile/PhotoGrid';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ChoiceList, MultiChips } from '@/components/ui/ChipGroup';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextField } from '@/components/ui/TextField';
import { GENDER_OPTIONS, INTERESTS } from '@/data/catalog';
import { useCurrentUser, useSession } from '@/state/Session';
import { colors, fonts, spacing } from '@/theme';
import { BIO_MAX, INTEREST_LIMITS, PHOTO_LIMITS } from '@/types/user';

export default function EditProfileScreen() {
  const user = useCurrentUser();
  const { updateProfile } = useSession();
  const { show } = useToast();
  const [form, setForm] = useState(user);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const problem =
    form.photos.length < PHOTO_LIMITS.min
      ? `Adicione pelo menos ${PHOTO_LIMITS.min} fotos`
      : form.interests.length < INTEREST_LIMITS.min
        ? `Escolha pelo menos ${INTEREST_LIMITS.min} interesses`
        : form.city.trim().length < 2 || !form.state
          ? 'Informe sua cidade e estado'
          : null;

  const save = async () => {
    if (problem) return show(problem, 'alert-circle', colors.danger);
    setSaving(true);
    try {
      const { id: _id, email: _email, ...changes } = form;
      await updateProfile({ ...changes, bio: changes.bio.trim(), job: changes.job.trim(), city: changes.city.trim() });
      show('Perfil atualizado', 'checkmark-circle', colors.mint);
      router.back();
    } catch {
      show('Não foi possível salvar. Tente de novo.', 'alert-circle', colors.danger);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Editar perfil" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="Fotos">
            <PhotoGrid photos={form.photos} onChange={(p) => set('photos', p)} />
          </Section>

          <Section title="Sobre você">
            <TextField
              label="Sobre mim"
              value={form.bio}
              onChangeText={(t) => set('bio', t)}
              multiline
              maxLength={BIO_MAX}
              counter
            />
            <TextField
              label="Profissão"
              icon="briefcase-outline"
              value={form.job}
              onChangeText={(t) => set('job', t)}
              maxLength={40}
            />
          </Section>

          <Section title={`Interesses · ${form.interests.length}/${INTEREST_LIMITS.max}`}>
            <MultiChips
              options={INTERESTS}
              value={form.interests}
              onChange={(v) => set('interests', v)}
              max={INTEREST_LIMITS.max}
              onLimit={() => show(`Máximo de ${INTEREST_LIMITS.max} interesses`, 'information-circle-outline')}
            />
          </Section>

          <Section title="Gênero">
            <ChoiceList options={GENDER_OPTIONS} value={form.gender} onChange={(v) => set('gender', v)} />
          </Section>

          <Section title="Localização">
            <LocationPicker
              value={{ city: form.city, state: form.state, country: form.country }}
              onChange={(place) => setForm((f) => ({ ...f, ...place }))}
            />
          </Section>
        </ScrollView>
        <View style={styles.footer}>
          <Button title="Salvar alterações" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xxl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.rose,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg },
});
