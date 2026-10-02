import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAppState } from '@/state/AppState';
import { colors, fonts, gradients, radii, spacing } from '@/theme';
import type { Conversation } from '@/types/chat';
import { formatShort } from '@/utils/time';

const openChat = (matchId: string) => router.push({ pathname: '/chat/[matchId]', params: { matchId } });

export default function ChatsScreen() {
  const { conversations, refresh } = useAppState();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const fresh = conversations.filter((c) => !c.lastMessageAt);
  const threads = conversations.filter((c) => c.lastMessageAt);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <FlatList
        data={threads}
        keyExtractor={(c) => c.matchId}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.rose} />}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Mensagens</Text>

            <Text style={styles.section}>Novos matches{fresh.length ? ` · ${fresh.length}` : ''}</Text>
            {fresh.length === 0 ? (
              <Text style={styles.hint}>
                {conversations.length === 0
                  ? 'Dê Kiss em quem você gostar. Quando for recíproco, aparece aqui.'
                  : 'Todos os seus matches já estão conversando. 🎉'}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.matchRow}>
                {fresh.map((c) => (
                  <Pressable key={c.matchId} style={styles.match} onPress={() => openChat(c.matchId)}>
                    <LinearGradient colors={gradients.brand} style={styles.ring}>
                      <Image source={c.profile.photos[0]} style={styles.avatar} />
                    </LinearGradient>
                    <Text style={styles.matchName} numberOfLines={1}>
                      {c.profile.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text style={[styles.section, { marginTop: spacing.xxl }]}>Conversas</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={40} color={colors.textFaint} />
            <Text style={styles.hint}>Suas conversas aparecem aqui. Que tal mandar o primeiro oi?</Text>
          </View>
        }
        renderItem={({ item }) => <ThreadRow conversation={item} />}
      />
    </SafeAreaView>
  );
}

function ThreadRow({ conversation: c }: { conversation: Conversation }) {
  const unread = c.unread > 0;
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} onPress={() => openChat(c.matchId)}>
      <Image source={c.profile.photos[0]} style={styles.rowAvatar} />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {c.profile.name}
          </Text>
          {c.profile.verified && <Ionicons name="checkmark-circle" size={14} color={colors.sky} />}
          <Text style={[styles.rowTime, unread && { color: colors.rose }]}>{formatShort(c.lastMessageAt!)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
            {c.lastFromMe ? 'Você: ' : ''}
            {c.lastMessage}
          </Text>
          {unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{c.unread > 9 ? '9+' : c.unread}</Text>
            </View>
          )}
          {!unread && c.lastFromMe && <Text style={styles.yourTurn}>Aguardando resposta</Text>}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.text, marginBottom: spacing.xl },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.rose,
    marginBottom: spacing.md,
  },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center' },
  matchRow: { gap: spacing.lg },
  match: { alignItems: 'center', gap: 6, width: 76 },
  ring: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: colors.background },
  matchName: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  empty: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  rowAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surface },
  rowBody: {
    flex: 1,
    gap: 4,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  rowTime: { marginLeft: 'auto', fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  preview: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  previewUnread: { fontFamily: fonts.semibold, color: colors.text },
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rose,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff' },
  yourTurn: { fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint },
});
