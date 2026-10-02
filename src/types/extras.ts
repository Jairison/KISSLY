/** Cidade escolhida no Passaporte (Gold/Platinum). */
export type Passport = {
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
};

export type BoostStatus = {
  /** ISO; null quando não há Boost ativo. */
  activeUntil: string | null;
  leftThisMonth: number;
};

export const BOOST_MINUTES = 30;

export type NotificationSettings = { newMatches: boolean; messages: boolean };

export type VerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';

/** Poses sorteadas para a selfie de verificação. */
export const VERIFICATION_POSES = [
  { emoji: '👍', text: 'Faça um joinha com a mão ao lado do rosto' },
  { emoji: '✌️', text: 'Faça um V com os dedos perto do rosto' },
  { emoji: '🤔', text: 'Apoie o queixo na mão' },
  { emoji: '👋', text: 'Acene com a mão aberta ao lado do rosto' },
  { emoji: '☝️', text: 'Aponte o dedo indicador para cima' },
];
