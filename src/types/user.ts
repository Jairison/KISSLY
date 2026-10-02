export type Gender = 'woman' | 'man' | 'nonbinary';
export type ShowMe = 'women' | 'men' | 'everyone';
export type Plan = 'free' | 'plus' | 'gold' | 'platinum';
export type DiscoveryScope = 'state' | 'national' | 'international';
export type SwipeDirection = 'left' | 'right' | 'up';

/** O perfil de quem está usando o app. */
export type UserProfile = {
  id: string;
  email: string;
  name: string;
  /** Formato ISO: AAAA-MM-DD */
  birthdate: string;
  gender: Gender;
  showMe: ShowMe;
  photos: string[];
  bio: string;
  job: string;
  interests: string[];
  city: string;
  state: string;
  country: string;
  /** Coordenadas do GPS; null quando a cidade foi digitada à mão. */
  lat: number | null;
  lng: number | null;
};

/** Perfil de outra pessoa, como aparece nos cards (sem data de nascimento nem coordenadas). */
export type Profile = {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  photos: string[];
  job?: string;
  bio: string;
  interests: string[];
  city: string;
  state: string;
  country: string;
  flag: string;
  /** null quando uma das pessoas não compartilhou a localização. */
  distanceKm: number | null;
  verified: boolean;
  /** Deu Super Like em você (aparece primeiro no baralho, com selo). */
  superLikedYou?: boolean;
  /** Só nos dados de demonstração locais: já curtiu o usuário. */
  likesYou?: boolean;
};

/** Quanto ainda resta hoje no plano atual. */
export type Usage = {
  plan: Plan;
  /** null = ilimitado */
  likesLeft: number | null;
  supersLeft: number;
  /** ISO: quando os limites reiniciam (meia-noite de Brasília) */
  resetsAt: string;
  canRewind: boolean;
};

export type DiscoveryPrefs = {
  ageMin: number;
  ageMax: number;
  /** null = sem limite de distância */
  maxDistanceKm: number | null;
};

export const DEFAULT_PREFS: DiscoveryPrefs = { ageMin: 18, ageMax: 45, maxDistanceKm: 120 };

export const AGE_LIMITS = { min: 18, max: 70 } as const;
export const DISTANCE_LIMITS = { min: 2, max: 500 } as const;

export const PHOTO_LIMITS = { min: 2, max: 6 } as const;
export const INTEREST_LIMITS = { min: 3, max: 5 } as const;
export const BIO_MAX = 300;

export const PREMIUM_PLANS: Plan[] = ['gold', 'platinum'];
export const isPremium = (plan: Plan) => PREMIUM_PLANS.includes(plan);

export function ageFromBirthdate(birthdate: string, today = new Date()): number {
  const [y, m, d] = birthdate.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export function profileCompletion(p: UserProfile): number {
  const checks = [
    p.photos.length >= PHOTO_LIMITS.min,
    p.photos.length >= 4,
    p.bio.trim().length >= 30,
    p.job.trim().length > 0,
    p.interests.length >= INTEREST_LIMITS.min,
    p.city.trim().length > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

export function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  if (km < 1) return 'a menos de 1 km';
  return km >= 1000 ? `${(km / 1000).toFixed(1).replace('.', ',')} mil km` : `${km} km`;
}
