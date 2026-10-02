import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInRight, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { BirthdateInput, checkBirthdate } from '@/components/profile/BirthdateInput';
import { DiscoveryFilters } from '@/components/profile/DiscoveryFilters';
import { LocationPicker } from '@/components/profile/LocationPicker';
import { PhotoGrid } from '@/components/profile/PhotoGrid';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ChoiceList, MultiChips } from '@/components/ui/ChipGroup';
import { TextField } from '@/components/ui/TextField';
import { GENDER_OPTIONS, INTERESTS, SHOW_ME_OPTIONS } from '@/data/catalog';
import { useSession } from '@/state/Session';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import {
  BIO_MAX,
  DEFAULT_PREFS,
  INTEREST_LIMITS,
  PHOTO_LIMITS,
  ageFromBirthdate,
  type DiscoveryPrefs,
  type Gender,
  type ShowMe,
} from '@/types/user';

type Draft = {
  name: string;
  birthdate: string;
  gender: Gender | null;
  showMe: ShowMe | null;
  photos: string[];
  bio: string;
  job: string;
  interests: string[];
  city: string;
  state: string;
  country: string;
  lat: number | null;
  lng: number | null;
};

type Step = { title: string; subtitle: string; valid: boolean; content: ReactNode };

export default function OnboardingScreen() {
  const { completeOnboarding, signOut } = useSession();
  const { show } = useToast();
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<DiscoveryPrefs>(DEFAULT_PREFS);
  const [draft, setDraft] = useState<Draft>({
    name: '',
    birthdate: '',
    gender: null,
    showMe: null,
    photos: [],
    bio: '',
    job: '',
    interests: [],
    city: '',
    state: '',
    country: 'Brasil',
    lat: null,
    lng: null,
  });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const firstName = draft.name.trim();

  const steps: Step[] = [
    {
      title: 'Como você quer ser chamado?',
      subtitle: 'É assim que seu nome vai aparecer no perfil.',
      valid: firstName.length >= 2,
      content: (
        <TextField
          autoFocus
          placeholder="Seu primeiro nome"
          value={draft.name}
          onChangeText={(t) => set('name', t)}
          maxLength={24}
          autoCapitalize="words"
          autoComplete="given-name"
          style={{ fontSize: 22 }}
        />
      ),
    },
    {
      title: `Prazer, ${firstName || 'você'}! Quando você nasceu?`,
      subtitle: 'Só sua idade aparece no perfil, nunca a data.',
      valid: checkBirthdate(draft.birthdate).ok,
      content: <BirthdateInput value={draft.birthdate} onChange={(v) => set('birthdate', v)} />,
    },
    {
      title: 'Como você se identifica?',
      subtitle: 'Respeito e diversidade fazem parte do Kissly.',
      valid: draft.gender !== null,
      content: <ChoiceList large options={GENDER_OPTIONS} value={draft.gender} onChange={(v) => set('gender', v)} />,
    },
    {
      title: 'Quem você quer conhecer?',
      subtitle: 'Você pode mudar isso quando quiser.',
      valid: draft.showMe !== null,
      content: <ChoiceList large options={SHOW_ME_OPTIONS} value={draft.showMe} onChange={(v) => set('showMe', v)} />,
    },
    {
      title: 'Suas melhores fotos',
      subtitle: `Adicione de ${PHOTO_LIMITS.min} a ${PHOTO_LIMITS.max} fotos. Perfis com 4 ou mais recebem muito mais Kiss.`,
      valid: draft.photos.length >= PHOTO_LIMITS.min,
      content: <PhotoGrid photos={draft.photos} onChange={(p) => set('photos', p)} />,
    },
    {
      title: 'Conte um pouco sobre você',
      subtitle: 'Uma bio sincera é o melhor começo de conversa.',
      valid: draft.bio.trim().length >= 10,
      content: (
        <View style={{ gap: spacing.sm }}>
          <TextField
            label="Sobre mim"
            placeholder="O que te faz sorrir? O que você procura aqui?"
            value={draft.bio}
            onChangeText={(t) => set('bio', t)}
            multiline
            maxLength={BIO_MAX}
            counter
          />
          <TextField
            label="Profissão (opcional)"
            icon="briefcase-outline"
            placeholder="Ex.: Arquiteta"
            value={draft.job}
            onChangeText={(t) => set('job', t)}
            maxLength={40}
          />
        </View>
      ),
    },
    {
      title: 'O que você curte?',
      subtitle: `Escolha de ${INTEREST_LIMITS.min} a ${INTEREST_LIMITS.max} interesses · ${draft.interests.length} selecionados`,
      valid: draft.interests.length >= INTEREST_LIMITS.min,
      content: (
        <MultiChips
          options={INTERESTS}
          value={draft.interests}
          onChange={(v) => set('interests', v)}
          max={INTEREST_LIMITS.max}
          onLimit={() => show(`Máximo de ${INTEREST_LIMITS.max} interesses`, 'information-circle-outline')}
        />
      ),
    },
    {
      title: 'Onde você está?',
      subtitle: 'Usamos sua cidade para o modo Estadual e para calcular distâncias.',
      valid: draft.city.trim().length >= 2 && draft.state.length > 0,
      content: (
        <LocationPicker
          value={{ city: draft.city, state: draft.state, country: draft.country, lat: draft.lat, lng: draft.lng }}
          onChange={(place) => setDraft((d) => ({ ...d, ...place }))}
        />
      ),
    },
    {
      title: 'Suas preferências',
      subtitle: 'Ajuste quem aparece para você. Dá para mudar depois.',
      valid: true,
      content: <DiscoveryFilters prefs={prefs} onChange={setPrefs} />,
    },
    {
      title: `Tudo pronto, ${firstName}!`,
      subtitle: 'Seu perfil está no ar. Hora de conhecer gente nova.',
      valid: true,
      content: <ProfilePreview draft={draft} />,
    },
  ];

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming((index + 1) / steps.length, { duration: 350 });
  }, [index, steps.length, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const next = async () => {
    if (!step.valid) return;
    if (!isLast) return setIndex((i) => i + 1);

    setSaving(true);
    try {
      await completeOnboarding(
        {
          name: firstName,
          birthdate: draft.birthdate,
          gender: draft.gender!,
          showMe: draft.showMe!,
          photos: draft.photos,
          bio: draft.bio.trim(),
          job: draft.job.trim(),
          interests: draft.interests,
          city: draft.city.trim(),
          state: draft.state,
          country: draft.country,
          lat: draft.lat,
          lng: draft.lng,
        },
        prefs,
      );
      // O guard do layout raiz leva automaticamente para as abas.
    } catch {
      show('Não foi possível salvar seu perfil. Tente de novo.', 'alert-circle', colors.danger);
      setSaving(false);
    }
  };

  const back = () => (index === 0 ? signOut() : setIndex((i) => i - 1));

  const body = (
    <Animated.View key={index} entering={FadeInRight.duration(280)} style={styles.stepBody}>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.subtitle}>{step.subtitle}</Text>
      <View style={{ marginTop: spacing.xl }}>{step.content}</View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} style={styles.back}>
          <Ionicons name={index === 0 ? 'close' : 'chevron-back'} size={22} color={colors.text} />
        </Pressable>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, progressStyle]}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <Text style={styles.counter}>
          {index + 1}/{steps.length}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={isLast ? 'Começar a explorar' : 'Continuar'}
            icon={isLast ? 'flame' : undefined}
            onPress={next}
            disabled={!step.valid}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfilePreview({ draft }: { draft: Draft }) {
  const age = draft.birthdate ? ageFromBirthdate(draft.birthdate) : null;
  return (
    <View style={styles.preview}>
      {draft.photos[0] && <Image source={draft.photos[0]} style={StyleSheet.absoluteFill} contentFit="cover" />}
      <LinearGradient colors={gradients.cardShade} locations={[0.4, 0.6, 1]} style={styles.previewShade}>
        <Text style={styles.previewName}>
          {draft.name.trim()} <Text style={styles.previewAge}>{age}</Text>
        </Text>
        <View style={styles.previewMeta}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.previewMetaText}>
            {draft.city}, {draft.state}
          </Text>
        </View>
        <View style={styles.previewTags}>
          {draft.interests.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.previewTag}>
              <Text style={styles.previewTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
  counter: { fontFamily: fonts.medium, fontSize: 13, color: colors.textFaint, minWidth: 36, textAlign: 'right' },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  stepBody: { flex: 1 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  preview: {
    alignSelf: 'center',
    width: '78%',
    aspectRatio: 3 / 4,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewShade: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', padding: spacing.lg, gap: 6 },
  previewName: { fontFamily: fonts.display, fontSize: 28, color: colors.text },
  previewAge: { fontFamily: fonts.regular, fontSize: 22 },
  previewMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  previewMetaText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  previewTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  previewTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  previewTagText: { fontFamily: fonts.medium, fontSize: 11, color: colors.text },
});
