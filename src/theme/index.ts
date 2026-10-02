// Design system do Kissly: escuro, elegante, com acentos rosé e dourado.

export const colors = {
  background: '#0B0810',
  surface: '#16111C',
  surfaceRaised: '#211A29',
  border: 'rgba(255,255,255,0.08)',

  text: '#F7F2F5',
  textMuted: '#A99FB0',
  textFaint: '#6E6475',

  rose: '#FF3D7F',
  coral: '#FF7A59',
  gold: '#E8C27A',
  goldDeep: '#B8893A',
  sky: '#4FC3F7',
  violet: '#A374FF',
  mint: '#3DDC97',
  danger: '#FF5470',
} as const;

export const gradients = {
  brand: ['#FF3D7F', '#FF7A59'] as const,
  gold: ['#F3D99B', '#C9973F'] as const,
  platinum: ['#E9E7F2', '#9C98B3'] as const,
  cardShade: ['transparent', 'rgba(11,8,16,0.35)', 'rgba(11,8,16,0.96)'] as const,
};

export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  displayItalic: 'PlayfairDisplay_600SemiBold_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radii = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;
