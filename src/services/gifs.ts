// Busca de GIFs no GIPHY. Exige uma chave grátis (developers.giphy.com) em
// EXPO_PUBLIC_GIPHY_API_KEY. O GIPHY pede o selo "Powered by GIPHY" na tela de busca.

export type Gif = { id: string; url: string; previewUrl: string; width: number; height: number };

const KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
export const isGifSearchConfigured = Boolean(KEY);

type GiphyImage = { url: string; width: string; height: string; webp?: string };
type GiphyItem = { id: string; images: { fixed_width: GiphyImage; fixed_width_small?: GiphyImage } };

export async function searchGifs(query: string): Promise<Gif[]> {
  if (!KEY) return [];
  const q = query.trim();
  const params = new URLSearchParams({ api_key: KEY, limit: '24', rating: 'pg-13', lang: 'pt' });
  if (q) params.set('q', q);
  const res = await fetch(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?${params}`);
  if (!res.ok) throw new Error(`GIPHY ${res.status}`);
  const { data } = (await res.json()) as { data: GiphyItem[] };
  return data
    .filter((g) => g.images?.fixed_width?.url)
    .map((g) => ({
      id: g.id,
      url: g.images.fixed_width.url,
      previewUrl: g.images.fixed_width_small?.url ?? g.images.fixed_width.url,
      width: Number(g.images.fixed_width.width) || 200,
      height: Number(g.images.fixed_width.height) || 200,
    }));
}
