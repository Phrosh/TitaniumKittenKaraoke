#!/usr/bin/env python3
"""
USDB Download Module
Lädt UltraStar-Dateien von USDB herunter
"""

import os
import re
import requests
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, parse_qs

from .meta import ProcessingMeta, ProcessingStatus
from .logger_utils import log_start

logger = logging.getLogger(__name__)

class USDBDownloader:
    """USDB-Downloader für UltraStar-Dateien"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialisiert den USDB-Downloader
        
        Args:
            config: Konfiguration für Downloads
        """
        self.config = config or {}
        self.default_config = {
            'timeout': 30,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'max_retries': 3,
            'temp_dir': 'temp'
        }
    
    def extract_usdb_id(self, url: str) -> Optional[str]:
        """
        Extrahiert die USDB-ID aus einer URL
        
        Args:
            url: USDB-URL
            
        Returns:
            USDB-ID oder None
        """
        patterns = [
            r'usdb\.animux\.de.*?id=(\d+)',
            r'usdb\.animux\.de.*?song=(\d+)',
            r'usdb\.animux\.de.*?(\d+)',
            r'usdb.*?id=(\d+)',
            r'usdb.*?song=(\d+)',
            r'usdb.*?(\d+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
    
    def get_usdb_metadata(self, usdb_id: str) -> Optional[Dict[str, Any]]:
        """
        Holt Metadaten für eine USDB-ID
        
        Args:
            usdb_id: USDB-ID
            
        Returns:
            Metadaten-Dictionary oder None
        """
        try:
            config = {**self.default_config, **self.config}
            
            # USDB-API-URL (falls verfügbar)
            api_url = f"https://usdb.animux.de/index.php?link=gettxt&id={usdb_id}"
            
            headers = {
                'User-Agent': config['user_agent']
            }
            
            logger.info(f"Hole USDB-Metadaten für ID: {usdb_id}")
            
            response = requests.get(api_url, headers=headers, timeout=config['timeout'])
            response.raise_for_status()
            
            # Parse UltraStar-Format
            content = response.text
            metadata = self._parse_ultrastar_metadata(content)
            
            if metadata:
                metadata['usdb_id'] = usdb_id
                metadata['raw_content'] = content
                logger.info(f"✅ USDB-Metadaten erfolgreich abgerufen: {metadata.get('title', 'Unknown')}")
                return metadata
            else:
                logger.error("Konnte USDB-Metadaten nicht parsen")
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der USDB-Metadaten: {e}")
            return None
    
    def _parse_ultrastar_metadata(self, content: str) -> Optional[Dict[str, Any]]:
        """
        Parst UltraStar-Metadaten aus dem Inhalt
        
        Args:
            content: UltraStar-Inhalt
            
        Returns:
            Metadaten-Dictionary oder None
        """
        try:
            metadata = {}
            lines = content.split('\n')
            
            for line in lines:
                line = line.strip()
                if line.startswith('#'):
                    # Parse UltraStar-Tags
                    if ':' in line:
                        tag, value = line.split(':', 1)
                        tag = tag.strip().upper()
                        value = value.strip()
                        
                        if tag == '#TITLE':
                            metadata['title'] = value
                        elif tag == '#ARTIST':
                            metadata['artist'] = value
                        elif tag == '#CREATOR':
                            metadata['creator'] = value
                        elif tag == '#LANGUAGE':
                            metadata['language'] = value
                        elif tag == '#YEAR':
                            metadata['year'] = value
                        elif tag == '#GENRE':
                            metadata['genre'] = value
                        elif tag == '#BPM':
                            metadata['bpm'] = value
                        elif tag == '#GAP':
                            metadata['gap'] = value
            
            # Validiere erforderliche Felder
            if 'title' in metadata and 'artist' in metadata:
                return metadata
            else:
                logger.error("Fehlende erforderliche Metadaten (TITLE oder ARTIST)")
                return None
                
        except Exception as e:
            logger.error(f"Fehler beim Parsen der UltraStar-Metadaten: {e}")
            return None
    
    def download_usdb_file(self, meta: ProcessingMeta) -> bool:
        """
        Lädt eine USDB-Datei herunter
        
        Args:
            meta: ProcessingMeta-Objekt mit USDB-URL
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('usdb_download.download_usdb_file', meta)
        if not meta.usdb_url:
            logger.error("Keine USDB-URL im Meta-Objekt")
            return False
        
        try:
            # Extrahiere USDB-ID
            usdb_id = self.extract_usdb_id(meta.usdb_url)
            if not usdb_id:
                logger.error(f"Konnte USDB-ID nicht aus URL extrahieren: {meta.usdb_url}")
                return False
            
            # Hole Metadaten
            metadata = self.get_usdb_metadata(usdb_id)
            if not metadata:
                logger.error(f"Konnte keine Metadaten für USDB-ID {usdb_id} abrufen")
                return False
            
            # Aktualisiere Meta-Objekt mit Metadaten
            meta.artist = metadata.get('artist', meta.artist)
            meta.title = metadata.get('title', meta.title)
            meta.update_metadata('usdb_metadata', metadata)
            
            # Aktualisiere Ordnername falls nötig
            new_folder_name = f"{meta.artist} - {meta.title}"
            if new_folder_name != meta.folder_name:
                old_path = meta.folder_path
                meta.folder_name = new_folder_name
                meta.folder_path = os.path.join(meta.base_dir, meta.folder_name)
                
                # Erstelle neuen Ordner und verschiebe falls nötig
                os.makedirs(meta.folder_path, exist_ok=True)
                if old_path != meta.folder_path and os.path.exists(old_path):
                    # Verschiebe Dateien vom alten zum neuen Ordner
                    for file in os.listdir(old_path):
                        old_file = os.path.join(old_path, file)
                        new_file = os.path.join(meta.folder_path, file)
                        os.rename(old_file, new_file)
                    os.rmdir(old_path)
            
            # Speichere UltraStar-Datei
            filename = f"{meta.artist} - {meta.title}.txt"
            file_path = meta.get_file_path(filename)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(metadata['raw_content'])
            
            meta.add_output_file(file_path)
            meta.add_keep_file(filename)
            
            logger.info(f"✅ USDB-Datei erfolgreich heruntergeladen: {filename}")
            meta.mark_step_completed('usdb_download')
            meta.status = ProcessingStatus.COMPLETED
            
            return True
            
        except Exception as e:
            logger.error(f"Fehler beim Herunterladen der USDB-Datei: {e}")
            meta.mark_step_failed('usdb_download')
            meta.status = ProcessingStatus.FAILED
            return False
    
    def search_usdb(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Sucht nach Songs in USDB
        
        Args:
            query: Suchbegriff
            limit: Maximale Anzahl Ergebnisse
            
        Returns:
            Liste der Suchergebnisse
        """
        try:
            config = {**self.default_config, **self.config}
            
            # USDB-Such-URL
            search_url = f"https://usdb.animux.de/index.php?link=list&search={query}"
            
            headers = {
                'User-Agent': config['user_agent']
            }
            
            logger.info(f"Suche USDB nach: {query}")
            
            response = requests.get(search_url, headers=headers, timeout=config['timeout'])
            response.raise_for_status()
            
            # Parse Suchergebnisse (vereinfacht)
            results = []
            content = response.text
            
            # Einfache Regex-basierte Suche nach Links
            pattern = r'href=".*?id=(\d+)".*?>(.*?)</a>'
            matches = re.findall(pattern, content)
            
            for match in matches[:limit]:
                usdb_id = match[0]
                title_info = match[1]
                
                # Extrahiere Artist und Title aus dem Titel-String
                if ' - ' in title_info:
                    artist, title = title_info.split(' - ', 1)
                    artist = artist.strip()
                    title = title.strip()
                else:
                    artist = "Unknown"
                    title = title_info.strip()
                
                results.append({
                    'usdb_id': usdb_id,
                    'artist': artist,
                    'title': title,
                    'url': f"https://usdb.animux.de/index.php?link=gettxt&id={usdb_id}"
                })
            
            logger.info(f"✅ {len(results)} USDB-Suchergebnisse gefunden")
            return results
            
        except Exception as e:
            logger.error(f"Fehler bei USDB-Suche: {e}")
            return []
    
    def download_from_search(self, meta: ProcessingMeta, search_query: str) -> bool:
        """
        Sucht und lädt eine USDB-Datei basierend auf einer Suche
        
        Args:
            meta: ProcessingMeta-Objekt
            search_query: Suchbegriff
            
        Returns:
            True wenn erfolgreich, False sonst
        """
        log_start('usdb_download.download_from_search', meta)
        try:
            # Suche nach Songs
            results = self.search_usdb(search_query, limit=5)
            
            if not results:
                logger.error("Keine USDB-Suchergebnisse gefunden")
                return False
            
            # Finde den besten Match
            best_match = None
            search_lower = search_query.lower()
            
            for result in results:
                result_text = f"{result['artist']} - {result['title']}".lower()
                if search_lower in result_text or result_text in search_lower:
                    best_match = result
                    break
            
            if not best_match:
                # Nehme das erste Ergebnis als Fallback
                best_match = results[0]
                logger.warning(f"Kein exakter Match gefunden, verwende: {best_match['artist']} - {best_match['title']}")
            
            # Setze USDB-URL im Meta-Objekt
            meta.usdb_url = best_match['url']
            
            # Lade die Datei herunter
            return self.download_usdb_file(meta)
            
        except Exception as e:
            logger.error(f"Fehler beim Download aus Suche: {e}")
            return False

def download_usdb_file(meta: ProcessingMeta) -> bool:
    """
    Convenience-Funktion für USDB-Download
    
    Args:
        meta: ProcessingMeta-Objekt
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('download_usdb_file', meta)
    downloader = USDBDownloader()
    return downloader.download_usdb_file(meta)

def search_and_download_usdb(meta: ProcessingMeta, search_query: str) -> bool:
    """
    Convenience-Funktion für USDB-Suche und Download
    
    Args:
        meta: ProcessingMeta-Objekt
        search_query: Suchbegriff
        
    Returns:
        True wenn erfolgreich, False sonst
    """
    log_start('search_and_download_usdb', meta)
    downloader = USDBDownloader()
    return downloader.download_from_search(meta, search_query)
