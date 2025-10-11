"""
BoilDown function - normalizes strings for better matching

Rules:
1. Remove "the" or "die" from the beginning
2. Convert to lowercase
3. Convert English number words to numeric (seven -> 7)
4. Remove spaces, punctuation and special characters - only keep numbers and word characters

Examples:
"Seven Nation army" -> "7nationarmy"
"The White Stripes" -> "whitestripes"
"""

import re
from typing import List, Dict, Any, Callable, Optional

# English number words to numeric conversion
NUMBER_WORDS: Dict[str, str] = {
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
}

def boil_down(input_string: str) -> str:
    """
    Normalize a string for better matching by applying boil down rules.
    
    Args:
        input_string: The string to normalize
        
    Returns:
        Normalized string
    """
    if not input_string or not isinstance(input_string, str):
        return ''
    
    result = input_string.strip()
    
    # 1. Remove "the" or "die" from the beginning
    words = result.split()
    if words:
        first_word = words[0].lower()
        if first_word in ['the', 'die']:
            result = ' '.join(words[1:]).strip()
    
    # 2. Convert to lowercase
    result = result.lower()
    
    # 3. Convert English number words to numeric
    # Split by word boundaries to handle individual words
    word_pattern = r'\b\w+\b'
    words_in_text = re.findall(word_pattern, result)
    
    for word in words_in_text:
        if word in NUMBER_WORDS:
            result = result.replace(word, NUMBER_WORDS[word])
    
    # 4. Remove spaces, punctuation and special characters - only keep numbers and word characters
    result = re.sub(r'[^\w\d]', '', result)
    
    return result

def boil_down_match(str1: str, str2: str) -> bool:
    """
    Check if two strings match after boiling down.
    
    Args:
        str1: First string to compare
        str2: Second string to compare
        
    Returns:
        True if strings match after normalization
    """
    return boil_down(str1) == boil_down(str2)

def find_boil_down_match(
    search_string: str,
    items: List[Any],
    get_artist: Callable[[Any], str],
    get_title: Callable[[Any], str]
) -> Optional[Any]:
    """
    Find a match in a list of items using boil down normalization.
    
    Args:
        search_string: String to search for
        items: List of items to search in
        get_artist: Function to extract artist from item
        get_title: Function to extract title from item
        
    Returns:
        First matching item or None if no match found
    """
    boiled_search = boil_down(search_string)
    
    for item in items:
        artist = get_artist(item)
        title = get_title(item)
        
        # Try exact match first
        if boil_down_match(artist, search_string) or boil_down_match(title, search_string):
            return item
        
        # Try combined match (artist - title)
        combined = f"{artist} - {title}"
        if boil_down_match(combined, search_string):
            return item
    
    return None

def boil_down_artist_title(artist: str, title: str) -> tuple[str, str]:
    """
    Apply boil down normalization to both artist and title.
    
    Args:
        artist: Artist name
        title: Song title
        
    Returns:
        Tuple of (normalized_artist, normalized_title)
    """
    return boil_down(artist), boil_down(title)
