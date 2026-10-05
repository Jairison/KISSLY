import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { noWebOutline } from '@/components/ui/TextField';
import { isGifSearchConfigured, searchGifs, type Gif } from '@/services/gifs';
import { colors, fonts, radii, spacing } from '@/theme';

type Props = { visible: boolean; onClose: () => void; onPick: (gif: Gif) => void };

/** Busca de GIFs (GIPHY). Sem a chave configurada, explica como ativar. */
export function GifPicker({ visible, onClose, onPick }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const tile = (Math.min(width, 520) - spacing.lg * 2 - spacing.sm) / 2;

  // Busca com uma pequena espera enquanto a pessoa digita.
  useEffect(() => {
    if (!visible || !isGifSearchConfigured) return;
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      searchGifs(query)
        .then((list) => alive && (setGifs(list), setFailed(false)))
        .catch(() => alive && setFailed(true))
        .finally(() => alive && setLoading(false));
    }, query ? 350 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.header}>
            <Text style={styles.title}>GIFs</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fechar GIFs">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          {!isGifSearchConfigured ? (
            <View style={styles.notice}>
              <Ionicons name="happy-outline" size={36} color={colors.textFaint} />
              <Text style={styles.noticeText}>
                A busca de GIFs ainda não foi ativada. É preciso uma chave grátis do GIPHY no app
                (EXPO_PUBLIC_GIPHY_API_KEY).
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.search}>
                <Ionicons name="search" size={18} color={colors.textFaint} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar GIFs"
                  placeholderTextColor={colors.textFaint}
                  selectionColor={colors.rose}
                  style={[styles.input, noWebOutline]}
                />
              </View>
              {loading && gifs.length === 0 ? (
                <ActivityIndicator color={colors.rose} style={{ margin: spacing.xl }} />
              ) : failed ? (
                <Text style={styles.noticeText}>Não foi possível buscar GIFs agora.</Text>
              ) : (
                <FlatList
                  data={gifs}
                  numColumns={2}
                  keyExtractor={(g) => g.id}
                  columnWrapperStyle={{ gap: spacing.sm }}
                  contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.md }}
                  style={{ maxHeight: 420 }}
                  ListEmptyComponent={<Text style={styles.noticeText}>Nenhum GIF encontrado.</Text>}
                  renderItem={({ item }) => (
                    <Pressable onPress={() => onPick(item)} accessibilityLabel="Enviar este GIF">
                      <Image
                        source={item.previewUrl}
                        style={{ width: tile, height: tile * (item.height / item.width), borderRadius: radii.sm }}
                        contentFit="cover"
                        autoplay
                      />
                    </Pressable>
                  )}
                />
              )}
              {/* Exigência do GIPHY: atribuição visível na busca. */}
              <Text style={styles.attribution}>Powered by GIPHY</Text>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  input: { flex: 1, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  notice: { alignItems: 'center', gap: spacing.md, padding: spacing.xl },
  noticeText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  attribution: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.textFaint, textAlign: 'center' },
});
