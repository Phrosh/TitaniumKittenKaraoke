const CAT_GIFS_API_URL = '/api/show/cat-gifs';

let cachedCatGifs: string[] | null = null;
let loadPromise: Promise<string[]> | null = null;

function normalizeFileList(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const files = (data as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];
  return files
    .map((entry) => String(entry || '').trim())
    .filter((name) => name.length > 0 && /\.gif$/i.test(name));
}

export async function loadCatGifs(): Promise<string[]> {
  if (cachedCatGifs) return cachedCatGifs;
  if (!loadPromise) {
    loadPromise = fetch(CAT_GIFS_API_URL)
      .then((response) => (response.ok ? response.json() : { files: [] }))
      .then((data) => {
        cachedCatGifs = normalizeFileList(data);
        return cachedCatGifs;
      })
      .catch(() => {
        cachedCatGifs = [];
        return cachedCatGifs;
      });
  }
  return loadPromise;
}

export function pickRandomCatGifUrl(files: string[]): string | null {
  if (!files.length) return null;
  const file = files[Math.floor(Math.random() * files.length)];
  return `${process.env.PUBLIC_URL || ''}/cat-gifs/${encodeURIComponent(file)}`;
}

export async function pickRandomCatGifUrlAsync(): Promise<string | null> {
  const files = await loadCatGifs();
  return pickRandomCatGifUrl(files);
}
