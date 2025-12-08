import { useEffect } from 'react';

/**
 * Custom Hook zum dynamischen Setzen des Document Titles
 * @param title - Der Titel, der gesetzt werden soll (ohne Suffix)
 */
export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const baseTitle = 'Titanium Kitten Karaoke';
    const fullTitle = title ? `${title} - ${baseTitle}` : baseTitle;
    document.title = fullTitle;

    // Cleanup: Setze den Titel zurück, wenn die Komponente unmounted wird
    return () => {
      document.title = baseTitle;
    };
  }, [title]);
};

