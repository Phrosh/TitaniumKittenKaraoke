export default (artist: string) => {
  const firstChar = artist.charAt(0).toUpperCase();
  if (/[A-Z]/.test(firstChar)) {
    return firstChar;
  } else if (/[0-9]/.test(firstChar)) {
    return '#';
  } else {
    return '#';
  }
};