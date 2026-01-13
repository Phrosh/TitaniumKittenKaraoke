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
const NUMBER_WORDS = {
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

/**
 * Normalize a string for better matching by applying boil down rules.
 * @param {string} inputString - The string to normalize
 * @returns {string} Normalized string
 */
function boilDown(inputString) {
  if (!inputString || typeof inputString !== 'string') {
    return '';
  }

  let result = inputString.trim();

  // 1. Remove "the" or "die" from the beginning
  const words = result.split(' ');
  if (words.length > 0) {
    const firstWord = words[0].toLowerCase();
    if (firstWord === 'the' || firstWord === 'die') {
      result = words.slice(1).join(' ').trim();
    }
  }

  // 2. Convert to lowercase
  result = result.toLowerCase();

  // 2.5. Normalize "&" and "&amp;" to "and" for better matching
  result = result.replace(/&amp;/g, ' and ');
  result = result.replace(/&/g, ' and ');

  // 3. Convert English number words to numeric
  // Split by word boundaries to handle individual words
  const wordPattern = /\b\w+\b/g;
  const wordsInText = result.match(wordPattern) || [];
  
  for (const word of wordsInText) {
    if (NUMBER_WORDS[word]) {
      result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), NUMBER_WORDS[word]);
    }
  }

  // 4. Remove spaces, punctuation and special characters - only keep numbers and word characters (but not underscores)
  result = result.replace(/[^\w\d]/g, '').replace(/_/g, '');

  return result;
}

/**
 * Check if two strings match after boiling down.
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {boolean} True if strings match after normalization
 */
function boilDownMatch(str1, str2) {
  return boilDown(str1) === boilDown(str2);
}

module.exports = {
  boilDown,
  boilDownMatch
};
