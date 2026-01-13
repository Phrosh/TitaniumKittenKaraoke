/**
 * BoilDown function - normalizes strings for better matching
 * 
 * Rules:
 * 1. Remove "the" or "die" from the beginning
 * 2. Convert to lowercase
 * 2.5. Normalize "&" and "&amp;" to "and" (e.g., "Hello & Goodbye" -> "Hello and Goodbye")
 * 3. Convert English number words to numeric (seven -> 7)
 * 4. Remove spaces, punctuation and special characters - only keep numbers and word characters
 * 
 * Examples:
 * "Seven Nation army" -> "7nationarmy"
 * "The White Stripes" -> "whitestripes"
 * "Hello & Goodbye" -> "helloandgoodbye"
 */

// English number words to numeric conversion
const NUMBER_WORDS: Record<string, string> = {
  'zero': '0',
  'one': '1',
  'two': '2',
  'three': '3',
  'four': '4',
  'five': '5',
  'six': '6',
  'seven': '7',
  'eight': '8',
  'nine': '9',
  'ten': '10',
  'eleven': '11',
  'twelve': '12',
  'thirteen': '13',
  'fourteen': '14',
  'fifteen': '15',
  'sixteen': '16',
  'seventeen': '17',
  'eighteen': '18',
  'nineteen': '19',
  'twenty': '20',
  'thirty': '30',
  'forty': '40',
  'fifty': '50',
  'sixty': '60',
  'seventy': '70',
  'eighty': '80',
  'ninety': '90',
  'hundred': '100',
  'thousand': '1000',
  'million': '1000000'
};

export function boilDown(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let result = input.trim();

  // 1. Remove "the" or "die" from the beginning
  const firstWord = result.split(' ')[0].toLowerCase();
  if (firstWord === 'the' || firstWord === 'die') {
    result = result.substring(firstWord.length).trim();
  }

  // 2. Convert to lowercase
  result = result.toLowerCase();

  // 2.5. Normalize "&" and "&amp;" to "and" for better matching
  result = result.replace(/&amp;/g, ' and ');
  result = result.replace(/&/g, ' and ');

  // 3. Convert English number words to numeric
  // Split by word boundaries to handle individual words
  const words = result.split(/\b/);
  const processedWords = words.map(word => {
    const cleanWord = word.toLowerCase().trim();
    return NUMBER_WORDS[cleanWord] || word;
  });
  result = processedWords.join('');

  // 4. Remove spaces, punctuation and special characters - only keep numbers and word characters
  result = result.replace(/[^\w\d]/g, '');

  return result;
}

// Helper function to check if two strings match after boiling down
export function boilDownMatch(str1: string, str2: string): boolean {
  return boilDown(str1) === boilDown(str2);
}

// Helper function to find matches in an array of objects
export function findBoilDownMatch<T>(
  searchString: string,
  items: T[],
  getArtist: (item: T) => string,
  getTitle: (item: T) => string
): T | undefined {
  const boiledSearch = boilDown(searchString);
  
  return items.find(item => {
    const artist = getArtist(item);
    const title = getTitle(item);
    
    // Try exact match first
    if (boilDownMatch(artist, searchString) || boilDownMatch(title, searchString)) {
      return true;
    }
    
    // Try combined match (artist - title)
    const combined = `${artist} - ${title}`;
    return boilDownMatch(combined, searchString);
  });
}
