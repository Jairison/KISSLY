import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import { PHOTO_LIMITS } from '@/types/user';
import { PermissionError, pickImages, type PickedImage } from '@/utils/pickImages';

/** O Storage aceita até 5 MB por foto (bucket "photos"). */
const MAX_ORIGINAL_BYTES = 4.5 * 1024 * 1024;

/** Reduz a foto para 1080px de largura em JPEG, deixando leve para salvar e enviar. */
async function optimize(uri: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: 1080 }).renderAsync();
  const result = await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  return result.uri;
}

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
};

export function PhotoGrid({ photos, onChange }: Props) {
  const { show } = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const remaining = PHOTO_LIMITS.max - photos.length;
    if (remaining <= 0) return;

    let assets: PickedImage[] | null;
    try {
      assets = await pickImages({ limit: remaining });
    } catch (e) {
      show(
        e instanceof PermissionError
          ? 'Permita o acesso às fotos nas configurações do aparelho'
          : 'Não foi possível abrir suas fotos. Tente de novo.',
        'images-outline',
        colors.danger,
      );
      return;
    }
    if (!assets) return;

    setBusy(true);
    // Uma foto por vez: no celular, várias fotos grandes ao mesmo tempo podem esgotar a memória.
    // E uma foto com problema não impede as outras de entrarem.
    const picked: string[] = [];
    let heic = 0;
    let failed = 0;
    for (const asset of assets) {
      try {
        picked.push(await optimize(asset.uri));
      } catch {
        const isHeic = /hei[cf]/i.test(`${asset.mimeType ?? ''} ${asset.fileName ?? ''}`);
        if (isHeic && Platform.OS === 'web') heic++;
        // Sem conseguir otimizar, usa a original se ela couber no limite de envio.
        else if (!asset.fileSize || asset.fileSize <= MAX_ORIGINAL_BYTES) picked.push(asset.uri);
        else failed++;
      }
    }
    setBusy(false);

    if (picked.length) onChange([...photos, ...picked]);
    if (heic) {
      show(
        `${heic === 1 ? 'Uma foto está' : `${heic} fotos estão`} em HEIC, formato que o navegador não abre. Escolha fotos JPG ou desligue "Fotos de alta eficiência" na câmera.`,
        'image-outline',
        colors.danger,
      );
    } else if (failed) {
      show(
        failed === 1 ? 'Não foi possível carregar uma das fotos. Tente outra.' : `Não foi possível carregar ${failed} fotos. Tente outras.`,
        'alert-circle',
        colors.danger,
      );
    }
  };

  const remove = (index: number) => onChange(photos.filter((_, i) => i !== index));

  const makeMain = (index: number) => {
    if (index === 0) return;
    const next = [...photos];
    const [chosen] = next.splice(index, 1);
    onChange([chosen, ...next]);
  };

  return (
    <View style={styles.grid}>
      {Array.from({ length: PHOTO_LIMITS.max }).map((_, i) => {
        const uri = photos[i];
        if (uri) {
          return (
            <Pressable key={uri} onPress={() => makeMain(i)} style={styles.slot}>
              <Image source={uri} style={StyleSheet.absoluteFill} contentFit="cover" />
              {i === 0 && (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.mainBadge}>
                  <Text style={styles.mainText}>Principal</Text>
                </LinearGradient>
              )}
              <Pressable onPress={() => remove(i)} hitSlop={8} style={styles.remove}>
                <Ionicons name="close" size={14} color={colors.background} />
              </Pressable>
            </Pressable>
          );
        }
        const isNext = i === photos.length;
        return (
          <Pressable key={`empty-${i}`} onPress={pick} disabled={busy} style={[styles.slot, styles.empty]}>
            {busy && isNext ? (
              <ActivityIndicator color={colors.rose} />
            ) : (
              <LinearGradient colors={isNext ? gradients.brand : [colors.surfaceRaised, colors.surfaceRaised]} style={styles.add}>
                <Ionicons name="add" size={20} color={isNext ? '#fff' : colors.textFaint} />
              </LinearGradient>
            )}
          </Pressable>
        );
      })}
      <Text style={styles.tip}>Toque numa foto para torná-la principal. Mínimo de {PHOTO_LIMITS.min} fotos.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    width: '31.5%',
    aspectRatio: 3 / 4,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
  },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  mainBadge: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill },
  mainText: { fontFamily: fonts.semibold, fontSize: 10, color: '#fff' },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  tip: { width: '100%', fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, marginTop: spacing.xs },
});
