import type { Gender, ShowMe } from '@/types/user';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Mulher' },
  { value: 'man', label: 'Homem' },
  { value: 'nonbinary', label: 'Não-binário' },
];

export const SHOW_ME_OPTIONS: { value: ShowMe; label: string }[] = [
  { value: 'women', label: 'Mulheres' },
  { value: 'men', label: 'Homens' },
  { value: 'everyone', label: 'Todos' },
];

export const INTERESTS = [
  'Viagens', 'Vinho', 'Café', 'Culinária', 'Fotografia', 'Arte', 'Cinema', 'Séries',
  'Leitura', 'Música ao vivo', 'Shows', 'Samba', 'Dança', 'Praia', 'Trilhas', 'Surf',
  'Yoga', 'Academia', 'Corrida', 'Futebol', 'Pets', 'Games', 'Moda', 'Arquitetura',
  'Idiomas', 'Teatro', 'Podcasts', 'Gastronomia', 'Meditação', 'Carnaval',
];

export const BRAZIL_STATES: { uf: string; name: string }[] = [
  { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' },
];

/** Converte "São Paulo" ou "SP" (formatos do geocoder no Android/iOS) para a UF. */
export function toUF(region: string | null | undefined): string | null {
  if (!region) return null;
  const clean = region.trim().toLowerCase();
  const match = BRAZIL_STATES.find((s) => s.uf.toLowerCase() === clean || s.name.toLowerCase() === clean);
  return match?.uf ?? null;
}
