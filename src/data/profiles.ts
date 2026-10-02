import { AGE_LIMITS, type DiscoveryPrefs, type DiscoveryScope, type Profile, type UserProfile } from '@/types/user';

// Perfis de demonstração, usados no modo local (sem Supabase configurado).

const photo = (img: number) => `https://i.pravatar.cc/800?img=${img}`;

export const profiles: Profile[] = [
  {
    id: 'p1', name: 'Isabela', age: 26, gender: 'woman', photos: [photo(26)], job: 'Arquiteta',
    bio: 'Café coado, museus vazios e viagens sem roteiro. Me leva pra conhecer seu restaurante favorito?',
    interests: ['Arquitetura', 'Vinho', 'Viagens'],
    city: 'Campinas', state: 'SP', country: 'Brasil', flag: '🇧🇷', distanceKm: 94, verified: true, likesYou: true,
  },
  {
    id: 'p2', name: 'Rafael', age: 29, gender: 'man', photos: [photo(12)], job: 'Fotógrafo',
    bio: 'Fotografo pessoas de verdade. Procuro alguém que ria alto e topa um pôr do sol no Ibirapuera.',
    interests: ['Fotografia', 'Jazz', 'Corrida'],
    city: 'São Paulo', state: 'SP', country: 'Brasil', flag: '🇧🇷', distanceKm: 4, verified: true, likesYou: false,
  },
  {
    id: 'p3', name: 'Sofia', age: 30, gender: 'woman', photos: [photo(36)], job: 'Designer de moda',
    bio: 'Lisboeta de coração. Se vier a Portugal, os pastéis de nata são por minha conta.',
    interests: ['Moda', 'Fado', 'Gastronomia'],
    city: 'Lisboa', state: 'Lisboa', country: 'Portugal', flag: '🇵🇹', distanceKm: 7930, verified: true, likesYou: true,
  },
  {
    id: 'p4', name: 'Camila', age: 28, gender: 'woman', photos: [photo(44)], job: 'Médica',
    bio: 'Plantão de dia, samba de noite. Quero alguém leve, que goste de praia e de conversa boa.',
    interests: ['Samba', 'Praia', 'Yoga'],
    city: 'Rio de Janeiro', state: 'RJ', country: 'Brasil', flag: '🇧🇷', distanceKm: 357, verified: false, likesYou: false,
  },
  {
    id: 'p5', name: 'Thiago', age: 31, gender: 'man', photos: [photo(13)], job: 'Chef de cozinha',
    bio: 'Cozinho melhor do que danço, mas danço mesmo assim. Primeiro encontro: jantar feito por mim.',
    interests: ['Culinária', 'Vinho', 'Música ao vivo'],
    city: 'Ribeirão Preto', state: 'SP', country: 'Brasil', flag: '🇧🇷', distanceKm: 313, verified: true, likesYou: true,
  },
  {
    id: 'p6', name: 'Lucía', age: 27, gender: 'woman', photos: [photo(45)], job: 'Professora de tango',
    bio: 'Buenos Aires, livros e tango. ¿Bailamos?',
    interests: ['Tango', 'Literatura', 'Teatro'],
    city: 'Buenos Aires', state: 'BA', country: 'Argentina', flag: '🇦🇷', distanceKm: 1680, verified: true, likesYou: false,
  },
  {
    id: 'p7', name: 'Luana', age: 25, gender: 'woman', photos: [photo(16)], job: 'Produtora musical',
    bio: 'Salvador, axé e beats. Se você tiver uma playlist boa, já ganhou pontos.',
    interests: ['Música', 'Carnaval', 'Dança'],
    city: 'Salvador', state: 'BA', country: 'Brasil', flag: '🇧🇷', distanceKm: 1450, verified: true, likesYou: true,
  },
  {
    id: 'p8', name: 'Diego', age: 32, gender: 'man', photos: [photo(68)], job: 'Engenheiro',
    bio: 'Madrid, futebol e tapas. Aprendendo português, me ajuda?',
    interests: ['Futebol', 'Idiomas', 'Tapas'],
    city: 'Madri', state: 'MD', country: 'Espanha', flag: '🇪🇸', distanceKm: 8370, verified: false, likesYou: false,
  },
  {
    id: 'p9', name: 'Valentina', age: 24, gender: 'woman', photos: [photo(47)], job: 'Advogada',
    bio: 'Litoral, livros e cachorros. Sinceridade acima de tudo.',
    interests: ['Pets', 'Leitura', 'Surf'],
    city: 'Santos', state: 'SP', country: 'Brasil', flag: '🇧🇷', distanceKm: 72, verified: true, likesYou: false,
  },
  {
    id: 'p10', name: 'Pedro', age: 27, gender: 'man', photos: [photo(53)], job: 'Desenvolvedor',
    bio: 'Curitiba, trilhas e café especial. Bora fugir pra serra no fim de semana?',
    interests: ['Trilhas', 'Café', 'Games'],
    city: 'Curitiba', state: 'PR', country: 'Brasil', flag: '🇧🇷', distanceKm: 339, verified: true, likesYou: true,
  },
  {
    id: 'p11', name: 'Chloé', age: 28, gender: 'woman', photos: [photo(23)], job: 'Sommelière',
    bio: 'Paris, vinho e cinema francês. Je cherche quelqu’un de vrai.',
    interests: ['Vinho', 'Cinema', 'Arte'],
    city: 'Paris', state: 'IDF', country: 'França', flag: '🇫🇷', distanceKm: 9410, verified: true, likesYou: false,
  },
  {
    id: 'p12', name: 'Beatriz', age: 29, gender: 'woman', photos: [photo(32)], job: 'Jornalista',
    bio: 'Pão de queijo, boas histórias e shows. Me conta a sua?',
    interests: ['Escrita', 'Shows', 'Podcasts'],
    city: 'Belo Horizonte', state: 'MG', country: 'Brasil', flag: '🇧🇷', distanceKm: 490, verified: false, likesYou: true,
  },
  {
    id: 'p13', name: 'Mariana', age: 27, gender: 'woman', photos: [photo(5)], job: 'Psicóloga',
    bio: 'Paulistana, adoro brunch e exposições. Procuro algo leve que pode virar sério.',
    interests: ['Arte', 'Brunch', 'Pilates'],
    city: 'São Paulo', state: 'SP', country: 'Brasil', flag: '🇧🇷', distanceKm: 6, verified: true, likesYou: false,
  },
  {
    id: 'p14', name: 'Amara', age: 26, gender: 'woman', photos: [photo(49)], job: 'Personal trainer',
    bio: 'Miami sun, good vibes. Amo o Brasil, já fui ao Rio 3 vezes!',
    interests: ['Fitness', 'Praia', 'Viagens'],
    city: 'Miami', state: 'FL', country: 'EUA', flag: '🇺🇸', distanceKm: 6550, verified: true, likesYou: true,
  },
  {
    id: 'p15', name: 'Gabriel', age: 30, gender: 'man', photos: [photo(59)], job: 'Professor',
    bio: 'Recife, frevo e livros. Nerd assumido com ótimo gosto pra comida.',
    interests: ['Livros', 'Frevo', 'Séries'],
    city: 'Recife', state: 'PE', country: 'Brasil', flag: '🇧🇷', distanceKm: 2130, verified: true, likesYou: false,
  },
  {
    id: 'p16', name: 'Marco', age: 33, gender: 'man', photos: [photo(11)], job: 'Barbeiro',
    bio: 'Milano, motos e espresso. Sempre sonhei em conhecer o Brasil.',
    interests: ['Motos', 'Café', 'Design'],
    city: 'Milão', state: 'MI', country: 'Itália', flag: '🇮🇹', distanceKm: 9550, verified: false, likesYou: true,
  },
];

type Viewer = Pick<UserProfile, 'state' | 'country' | 'showMe'>;

/** Monta o baralho de perfis conforme alcance, gênero de interesse, idade e distância. */
export function buildDeck(list: Profile[], viewer: Viewer, prefs: DiscoveryPrefs, scope: DiscoveryScope): Profile[] {
  return list.filter((p) => {
    const sameCountry = p.country === viewer.country;
    if (scope === 'state' && !(sameCountry && p.state === viewer.state)) return false;
    if (scope === 'national' && !sameCountry) return false;
    if (scope === 'international' && sameCountry) return false;
    if (viewer.showMe === 'women' && p.gender !== 'woman') return false;
    if (viewer.showMe === 'men' && p.gender !== 'man') return false;
    if (p.age < prefs.ageMin) return false;
    // No limite do slider (70+) não há teto de idade.
    if (prefs.ageMax < AGE_LIMITS.max && p.age > prefs.ageMax) return false;
    // A distância máxima vale para o modo Estadual; Nacional e Internacional ampliam o alcance de propósito.
    if (scope === 'state' && prefs.maxDistanceKm !== null && (p.distanceKm ?? 0) > prefs.maxDistanceKm) return false;
    return true;
  });
}

