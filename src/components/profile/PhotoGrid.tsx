import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useToast } from '@/components/Toast';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import { PHOTO_LIMITS } from '@/types/user';

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

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      show('Permita o acesso às fotos nas configurações do aparelho', 'images-outline', colors.danger);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    });
    if (result.canceled) return;

    setBusy(true);
    try {
      const picked = await Promise.all(result.assets.slice(0, remaining).map((a) => optimize(a.uri)));
      onChange([...photos, ...picked]);
    } catch {
      show('Não foi possível carregar essa foto', 'alert-circle', colors.danger);
    } finally {
      setBusy(false);
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
