import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BackendError, backend } from '@/services/backend';
import { useCurrentUser } from '@/state/Session';
import { colors, fonts, radii, spacing } from '@/theme';
import { VERIFICATION_POSES, type VerificationStatus } from '@/types/extras';
import { PermissionError, pickImages, type PickedImage } from '@/utils/pickImages';

const pickPose = () => VERIFICATION_POSES[Math.floor(Math.random() * VERIFICATION_POSES.length)];

export default function VerifyScreen() {
  const me = useCurrentUser();
  const { show } = useToast();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [pose, setPose] = useState(pickPose);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    backend.verificationStatus().then(setStatus).catch(() => setStatus('none'));
  }, []);

  const takeSelfie = async () => {
    let picked: PickedImage[] | null;
    try {
      picked = await pickImages({ limit: 1, camera: true });
    } catch (e) {
      show(
        e instanceof PermissionError
          ? 'Permita o acesso à câmera nas configurações do aparelho'
          : 'Não foi possível abrir a câmera. Tente de novo.',
        'camera-outline',
        colors.danger,
      );
      return;
    }
    if (!picked) return;
    try {
      const image = await ImageManipulator.manipulate(picked[0].uri).resize({ width: 1080 }).renderAsync();
      setSelfie((await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })).uri);
    } catch {
      show('Não foi possível usar essa foto. Tire outra, de preferência em JPG.', 'alert-circle', colors.danger);
    }
  };

  const submit = async () => {
    if (!selfie) return;
    setSending(true);
    try {
      await backend.submitVerification(selfie, pose.text);
      setStatus('pending');
      show('Selfie enviada! Avisaremos quando for analisada.', 'shield-checkmark', colors.mint);
    } catch (e) {
      show(e instanceof BackendError ? e.message : 'Não foi possível enviar', 'alert-circle', colors.danger);
    } finally {
      setSending(false);
    }
  };

  if (status === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.sky} />
      </View>
    );
  }

  if (status === 'approved' || status === 'pending') {
    const approved = status === 'approved';
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader mode="close" />
        <View style={[styles.center, { flex: 1, padding: spacing.xl, gap: spacing.lg }]}>
          <View style={[styles.badge, { backgroundColor: approved ? 'rgba(79,195,247,0.15)' : 'rgba(232,194,122,0.15)' }]}>
            <Ionicons name={approved ? 'checkmark-circle' : 'time-outline'} size={56} color={approved ? colors.sky : colors.gold} />
          </View>
          <Text style={styles.title}>{approved ? 'Perfil verificado' : 'Verificação em análise'}</Text>
          <Text style={styles.text}>
            {approved
              ? 'Seu perfil exibe o selo azul. Pessoas verificadas recebem mais matches e passam mais confiança.'
              : 'Nossa equipe compara sua selfie com as fotos do perfil. Costuma levar até 24 horas.'}
          </Text>
          <Button title="Fechar" variant="outline" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader mode="close" title="Verificar perfil" />
      <ScrollView contentContainerStyle={styles.content}>
        {status === 'rejected' && (
          <View style={styles.rejected}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.rejectedText}>
              A última selfie não foi aprovada. Confira se o rosto está bem iluminado e se a pose está igual.
            </Text>
          </View>
        )}

        <View style={styles.hero}>
          <View style={[styles.badge, { backgroundColor: 'rgba(79,195,247,0.15)' }]}>
            <Ionicons name="shield-checkmark" size={44} color={colors.sky} />
          </View>
          <Text style={styles.title}>Mostre que é você de verdade</Text>
          <Text style={styles.text}>
            Tire uma selfie imitando a pose abaixo. A foto só é vista pela nossa equipe de segurança e não aparece no seu
            perfil.
          </Text>
        </View>

        <Animated.View key={pose.text} entering={FadeInDown} style={styles.pose}>
          <Text style={styles.poseEmoji}>{pose.emoji}</Text>
          <Text style={styles.poseText}>{pose.text}</Text>
          <Text style={styles.poseShuffle} onPress={() => setPose(pickPose())}>
            Sortear outra pose
          </Text>
        </Animated.View>

        {selfie ? (
          <View style={styles.preview}>
            <Image source={selfie} style={styles.previewImage} contentFit="cover" />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Text style={styles.previewText}>A pose está igual e o rosto aparece bem?</Text>
              <Text style={styles.retake} onPress={takeSelfie}>
                Tirar outra
              </Text>
            </View>
          </View>
        ) : (
          <Image source={me.photos[0]} style={styles.reference} contentFit="cover" />
        )}

        {selfie ? (
          <Button title="Enviar para análise" icon="send" onPress={submit} loading={sending} />
        ) : (
          <Button title="Tirar selfie" icon="camera" onPress={takeSelfie} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.xl },
  hero: { alignItems: 'center', gap: spacing.md },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, textAlign: 'center' },
  text: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted, textAlign: 'center' },
  pose: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.35)',
  },
  poseEmoji: { fontSize: 48 },
  poseText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text, textAlign: 'center' },
  poseShuffle: { fontFamily: fonts.medium, fontSize: 13, color: colors.sky, marginTop: spacing.xs },
  reference: { alignSelf: 'center', width: 120, height: 150, borderRadius: radii.md, opacity: 0.5 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  previewImage: { width: 110, height: 140, borderRadius: radii.md, backgroundColor: colors.surface },
  previewText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: colors.text },
  retake: { fontFamily: fonts.semibold, fontSize: 14, color: colors.rose },
  rejected: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,84,112,0.1)',
  },
  rejectedText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.text },
});
