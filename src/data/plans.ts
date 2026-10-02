import type { Ionicons } from '@expo/vector-icons';

import type { Plan } from '@/types/user';

type IconName = keyof typeof Ionicons.glyphMap;
export type PaidPlan = Exclude<Plan, 'free'>;

/** Recursos que levam à tela de planos já com o plano certo selecionado. */
export type Feature = 'likes' | 'super' | 'rewind' | 'see_likes' | 'international' | 'priority' | 'boost';

export type PlanInfo = {
  id: PaidPlan;
  name: string;
  tagline: string;
  icon: IconName;
  /** Cores do degradê do plano. */
  colors: readonly [string, string];
  /** Cor do texto sobre o degradê. */
  ink: string;
  perks: { icon: IconName; text: string; feature?: Feature }[];
};

// Mesmos limites da função plan_limits no banco (supabase/migrations/20261003000000_plans.sql).
export const LIMITS: Record<Plan, { dailyLikes: number | null; dailySupers: number; canRewind: boolean }> = {
  free: { dailyLikes: 50, dailySupers: 1, canRewind: false },
  plus: { dailyLikes: null, dailySupers: 3, canRewind: true },
  gold: { dailyLikes: null, dailySupers: 5, canRewind: true },
  platinum: { dailyLikes: null, dailySupers: 10, canRewind: true },
};

export const PLAN_LABEL: Record<Plan, string> = {
  free: 'Kissly Free',
  plus: 'Kissly Plus',
  gold: 'Kissly Gold',
  platinum: 'Kissly Platinum',
};

const PLUS_PERKS: PlanInfo['perks'] = [
  { icon: 'infinite', text: 'Kiss ilimitados', feature: 'likes' },
  { icon: 'arrow-undo', text: 'Voltar o último perfil que você passou', feature: 'rewind' },
  { icon: 'star', text: '3 Super Likes por dia', feature: 'super' },
];

export const PLANS: PlanInfo[] = [
  {
    id: 'plus',
    name: 'Plus',
    tagline: 'Sem limites para curtir',
    icon: 'add-circle',
    colors: ['#FF3D7F', '#FF7A59'],
    ink: '#FFFFFF',
    perks: PLUS_PERKS,
  },
  {
    id: 'gold',
    name: 'Gold',
    tagline: 'Veja quem já curtiu você',
    icon: 'diamond',
    colors: ['#F3D99B', '#C9973F'],
    ink: '#0B0810',
    perks: [
      { icon: 'eye', text: 'Veja quem curtiu você', feature: 'see_likes' },
      { icon: 'globe', text: 'Modo Internacional: conheça o mundo', feature: 'international' },
      { icon: 'star', text: '5 Super Likes por dia', feature: 'super' },
      { icon: 'flash', text: '1 Boost grátis por mês', feature: 'boost' },
      { icon: 'checkmark-done', text: 'Tudo do Plus' },
    ],
  },
  {
    id: 'platinum',
    name: 'Platinum',
    tagline: 'Seja visto(a) primeiro',
    icon: 'sparkles',
    colors: ['#F2F0FA', '#9C98B3'],
    ink: '#0B0810',
    perks: [
      { icon: 'rocket', text: 'Kiss prioritário: apareça antes para quem você curtiu', feature: 'priority' },
      { icon: 'star', text: '10 Super Likes por dia', feature: 'super' },
      { icon: 'flash', text: '3 Boosts grátis por mês', feature: 'boost' },
      { icon: 'checkmark-done', text: 'Tudo do Gold' },
    ],
  },
];

/** Qual plano mostrar primeiro ao abrir a tela a partir de um recurso bloqueado. */
export const PLAN_FOR_FEATURE: Record<Feature, PaidPlan> = {
  likes: 'plus',
  rewind: 'plus',
  super: 'gold',
  see_likes: 'gold',
  international: 'gold',
  boost: 'gold',
  priority: 'platinum',
};

export const PLAN_RANK: Record<Plan, number> = { free: 0, plus: 1, gold: 2, platinum: 3 };

export type Duration = 'monthly' | 'semiannual' | 'annual';

export const DURATIONS: { id: Duration; months: number; label: string }[] = [
  { id: 'monthly', months: 1, label: '1 mês' },
  { id: 'semiannual', months: 6, label: '6 meses' },
  { id: 'annual', months: 12, label: '12 meses' },
];

/**
 * Preços de referência (R$) usados no modo demonstração e enquanto a loja não responde.
 * Os preços reais vêm da App Store / Google Play via RevenueCat.
 */
export const REFERENCE_PRICES: Record<PaidPlan, Record<Duration, number>> = {
  plus: { monthly: 29.9, semiannual: 119.4, annual: 179.9 },
  gold: { monthly: 49.9, semiannual: 209.4, annual: 299.9 },
  platinum: { monthly: 79.9, semiannual: 329.4, annual: 479.9 },
};

export const formatBRL = (value: number) =>
  `R$ ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
