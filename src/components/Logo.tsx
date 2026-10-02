import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, gradients } from '@/theme';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <LinearGradient colors={gradients.brand} style={[styles.mark, { width: size, height: size, borderRadius: size * 0.32 }]}>
        <Ionicons name="heart" size={size * 0.58} color="#fff" />
      </LinearGradient>
      <Text style={[styles.word, { fontSize: size }]}>Kissly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  word: { fontFamily: fonts.displayItalic, color: colors.text, letterSpacing: 0.5 },
});
