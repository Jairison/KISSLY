export type Gender = 'woman' | 'man' | 'nonbinary';
export type ShowMe = 'women' | 'men' | 'everyone';

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
