import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppState } from '@/state/AppState';
import { colors, fonts } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon = (name: IconName, active: IconName) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : name} size={24} color={color} />
  );

export default function TabsLayout() {
  const { matches, likesCount } = useAppState();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.rose,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: 84,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Descobrir', tabBarIcon: icon('flame-outline', 'flame') }} />
      <Tabs.Screen
        name="likes"
        options={{
          title: 'Curtidas',
          tabBarIcon: icon('sparkles-outline', 'sparkles'),
          tabBarBadge: likesCount || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.background, fontFamily: fonts.bold, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Mensagens',
          tabBarIcon: icon('chatbubbles-outline', 'chatbubbles'),
          tabBarBadge: matches.length || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.rose, fontFamily: fonts.bold, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
