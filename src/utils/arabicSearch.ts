/**
 * Normalizes Arabic text for lightning-fast, diacritic-tolerant fuzzy search.
 * Handles Hamza variants (أ, إ, آ -> ا), Taa Marbuta (ة -> ه), Yaa/Alef Maqsura (ى -> ي),
 * strips Tashkeel (harakat/diacritics), and removes Tatweel/Kashida.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    // Remove Tashkeel (Arabic diacritics)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Remove Tatweel / Kashida
    .replace(/\u0640/g, '')
    // Normalize Alef forms
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Taa Marbuta to Haa
    .replace(/ة/g, 'ه')
    // Normalize Alef Maqsura to Yaa
    .replace(/ى/g, 'ي')
    // Normalize Persian/Urdu Kaf and Yeh if entered
    .replace(/ك/g, 'ك')
    .replace(/ي/g, 'ي');
}

/**
 * Checks if a search query matches a product based on name, description, category, or variants
 */
export function matchesSearch(
  query: string,
  targetFields: (string | undefined | null)[]
): boolean {
  if (!query || query.trim() === '') return true;

  const normalizedQuery = normalizeArabicText(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  const combinedNormalizedText = targetFields
    .filter(Boolean)
    .map(field => normalizeArabicText(field!))
    .join(' ');

  // All tokens must be present in the target fields
  return queryTokens.every(token => combinedNormalizedText.includes(token));
}
