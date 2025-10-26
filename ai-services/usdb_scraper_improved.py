"""
Improved USDB Scraper with better error handling and multiple login strategies
"""

import requests
import re
import os
import zipfile
import tempfile
import subprocess
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging

logger = logging.getLogger(__name__)

def sanitize_filename(filename):
    """
    Sanitizes a filename by removing or replacing invalid characters
    """
    if not filename or not isinstance(filename, str):
        return ''
    
    # Characters not allowed in Windows/Linux filenames
    invalid_chars = r'[<>:"/\\|?*\x00-\x1f]'
    
    # Replace invalid characters with underscores
    sanitized = re.sub(invalid_chars, '_', filename)
    
    # Remove leading/trailing dots and spaces
    sanitized = re.sub(r'^[.\s]+|[.\s]+$', '', sanitized)
    
    # Replace multiple consecutive underscores with single underscore
    sanitized = re.sub(r'_+', '_', sanitized)
    
    # Remove leading/trailing underscores
    sanitized = re.sub(r'^_+|_+$', '', sanitized)
    
    # Ensure the filename is not empty and not too long
    if not sanitized or len(sanitized) == 0:
        sanitized = 'unnamed'
    
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    
    return sanitized

def create_sanitized_folder_name(artist, title):
    """
    Creates a sanitized folder name for YouTube downloads
    """
    artist_sanitized = sanitize_filename(artist or 'Unknown Artist')
    title_sanitized = sanitize_filename(title or 'Unknown Title')
    
    return f"{artist_sanitized} - {title_sanitized}"

class USDBScraperImproved:
    def __init__(self, username=None, password=None):
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
        })
        self.base_url = 'https://usdb.animux.de'
        self.logged_in = False
        
        # Enable cookie jar for better session management
        self.session.cookies.clear()

    def login(self):
        """Login to USDB using the proven method from usdb_find_ids.py"""
        if not self.username or not self.password:
            raise ValueError("Username and password are required for login")
        
        logger.info(f"Attempting login for user: {self.username}")
        
        try:
            # Use the exact same method as usdb_find_ids.py
            login_url = f"{self.base_url}/index.php?link=login"
            
            # First get the login page to establish session
            login_page_response = self.session.get(login_url, timeout=30)
            login_page_response.raise_for_status()
            
            response = self.session.post(
                login_url,
                data={"user": self.username, "pass": self.password, "login": "Login"},
                headers={
                    **self.session.headers,
                    "Origin": self.base_url,
                    "Referer": login_url
                },
                timeout=30
            )
            response.raise_for_status()
            
            # Quick check: Profile page is only accessible when logged in
            prof_response = self.session.get(
                f"{self.base_url}/index.php?link=profil",
                headers=self.session.headers,
                timeout=30
            )
            
            if "You are not logged in" in prof_response.text:
                logger.error("Login verification failed - not logged in")
                raise RuntimeError("Login fehlgeschlagen oder Session nicht aktiv.")
            
            self.logged_in = True
            logger.info("Login successful")
            return True
            
        except Exception as e:
            logger.error(f"Login failed: {str(e)}")
            raise Exception(f"Login failed: {str(e)}")

    def _find_login_form(self, soup):
        """Find login form using multiple strategies"""
        # Strategy 1: Look for form with action containing 'login'
        form = soup.find('form', {'action': lambda x: x and 'login' in x})
        if form:
            return form
        
        # Strategy 2: Look for form with username/password inputs
        forms = soup.find_all('form')
        for form in forms:
            inputs = form.find_all('input')
            has_username = any(inp.get('name', '').lower() in ['username', 'user', 'login'] for inp in inputs)
            has_password = any(inp.get('type', '').lower() == 'password' for inp in inputs)
            if has_username and has_password:
                return form
        
        # Strategy 3: Look for form with specific input names
        for form in forms:
            inputs = form.find_all('input')
            input_names = [inp.get('name', '').lower() for inp in inputs]
            if 'user' in input_names and 'pass' in input_names:
                return form
        
        return None

    def _try_form_login(self, form, base_url):
        """Try to login using form data"""
        try:
            # Extract form data
            form_data = {}
            for inp in form.find_all('input'):
                name = inp.get('name')
                value = inp.get('value', '')
                if name:
                    form_data[name] = value
            
            # Update with credentials - based on debug output, use 'user' and 'pass'
            form_data['user'] = self.username
            form_data['pass'] = self.password
            
            # Submit form
            action = form.get('action', '')
            if action:
                if not action.startswith('http'):
                    action = urljoin(base_url, action)
            else:
                action = f"{self.base_url}/index.php?&link=login"
            
            response = self.session.post(action, data=form_data)
            response.raise_for_status()
            
            return self._check_login_success(response)
            
        except Exception as e:
            logger.warning(f"Form login failed: {str(e)}")
            return False

    def _check_login_success(self, response):
        """Check if login was successful"""
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check for success indicators
        has_logout = bool(soup.find('a', href=lambda x: x and 'logout' in x))
        has_user_menu = bool(soup.find('a', href=lambda x: x and 'profil' in x))
        welcome_text = soup.find(text=lambda x: x and 'welcome' in x.lower())
        
        # Check for failure indicators
        still_has_login = bool(soup.find('form', {'action': lambda x: x and 'login' in x}))
        error_messages = soup.find_all(text=lambda x: x and any(word in x.lower() for word in ['error', 'invalid', 'failed', 'incorrect', 'wrong']))
        
        logger.info(f"Login check - Logout: {has_logout}, User menu: {has_user_menu}, Welcome: {bool(welcome_text)}, Still has login: {still_has_login}, Errors: {len(error_messages)}")
        
        # Success if we have logout/user menu and no login form
        success = (has_logout or has_user_menu) and not still_has_login
        
        if not success and error_messages:
            logger.warning(f"Login error messages: {[msg.strip() for msg in error_messages[:3]]}")
        
        return success

    def get_song_info(self, song_id):
        """Get song information from USDB"""
        try:
            if not self.logged_in:
                self.login()
            
            url = f"{self.base_url}/index.php?link=detail&id={song_id}"
            response = self.session.get(url)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract song information
            song_info = {
                'id': song_id,
                'title': '',
                'artist': '',
                'language': '',
                'genre': '',
                'year': '',
                'bpm': '',
                'gap': '',
                'preview': '',
                'download_url': '',
                'cover_url': '',
                'video_url': '',
                'youtube_url': ''
            }
            
            # First try to get from page title (most reliable)
            page_title = soup.find('title')
            if page_title:
                title_text = page_title.get_text(strip=True)
                # USDB titles have format "USDB - Artist - Song Title"
                if title_text.startswith('USDB - '):
                    parts = title_text[7:].strip()  # Remove "USDB - "
                    if ' - ' in parts:
                        artist, title = parts.split(' - ', 1)
                        song_info['artist'] = artist.strip()
                        song_info['title'] = title.strip()
            
            # Parse song details from table - try multiple table structures
            details_table = soup.find('table', {'class': 'song'})
            if not details_table:
                # Try alternative table selectors - look for table with border=0 and width=500
                details_table = soup.find('table', {'border': '0', 'width': '500'})
            
            if details_table:
                rows = details_table.find_all('tr')
                for row in rows:
                    cells = row.find_all('td')
                    if len(cells) >= 2:
                        label = cells[0].get_text(strip=True).lower()
                        value = cells[1].get_text(strip=True)
                        
                        if 'language' in label:
                            song_info['language'] = value
                        elif 'genre' in label:
                            song_info['genre'] = value
                        elif 'year' in label:
                            song_info['year'] = value
                        elif 'bpm' in label:
                            song_info['bpm'] = value
                        elif 'gap' in label:
                            song_info['gap'] = value
            
            # Set download URL - USDB uses POST to gettxt endpoint
            song_info['download_url'] = f"{self.base_url}/index.php?link=gettxt&id={song_id}"
            
            # Find cover image
            cover_img = soup.find('img', src=lambda x: x and ('cover' in x.lower() or 'jpg' in x.lower() or 'png' in x.lower()))
            if cover_img:
                song_info['cover_url'] = urljoin(self.base_url, cover_img.get('src'))
            
            # Extract video URL from the song text (if available)
            try:
                # Get the song text to extract video URL
                response = self.session.post(
                    f"{self.base_url}/index.php",
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    params={"link": "gettxt", "id": str(song_id)},
                    data={"wd": "1"}
                )
                response.raise_for_status()
                
                soup_text = BeautifulSoup(response.text, 'html.parser')
                textarea = soup_text.find('textarea')
                if textarea and textarea.string:
                    text_content = textarea.string
                    lines = text_content.split('\n')
                    
                    # Look for VIDEO line in the text
                    for line in lines:
                        if line.startswith('#VIDEO:'):
                            video_info = line[7:].strip()  # Remove '#VIDEO:'
                            # Extract YouTube URL from video info
                            # Format is usually: v=VIDEO_ID,co=COVER_IMAGE,bg=BACKGROUND_IMAGE
                            if 'v=' in video_info:
                                video_id = video_info.split('v=')[1].split(',')[0]
                                youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                                song_info['video_url'] = youtube_url
                                song_info['youtube_url'] = youtube_url
                                logger.info(f"Found YouTube video ID: {video_id}")
                            break
            except Exception as e:
                logger.warning(f"Could not extract video URL from song text: {str(e)}")
            
            # Fallback: Try to extract embedded YouTube video from the detail page HTML
            if not song_info.get('video_url'):
                try:
                    logger.info("Trying to extract YouTube video from embedded iframe on detail page...")
                    
                    # Look for iframe elements with YouTube embeds
                    iframes = soup.find_all('iframe', class_='embed')
                    
                    for iframe in iframes:
                        src = iframe.get('src', '')
                        if 'youtube.com/embed' in src or 'youtu.be' in src:
                            # Extract video ID from embed URL
                            # Examples: 
                            # - https://www.youtube.com/embed/WeZgjAORWjM
                            # - https://youtu.be/WeZgjAORWjM
                            video_id_match = re.search(r'(?:embed/|youtu\.be/)([a-zA-Z0-9_-]+)', src)
                            if video_id_match:
                                video_id = video_id_match.group(1)
                                youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                                song_info['video_url'] = youtube_url
                                song_info['youtube_url'] = youtube_url
                                logger.info(f"Found YouTube video ID from embedded iframe: {video_id}")
                                break
                    
                    # Also try to find other iframe patterns
                    if not song_info.get('video_url'):
                        iframes = soup.find_all('iframe')
                        for iframe in iframes:
                            src = iframe.get('src', '')
                            if 'youtube.com/embed' in src or 'youtu.be' in src:
                                video_id_match = re.search(r'(?:embed/|youtu\.be/)([a-zA-Z0-9_-]+)', src)
                                if video_id_match:
                                    video_id = video_id_match.group(1)
                                    youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                                    song_info['video_url'] = youtube_url
                                    song_info['youtube_url'] = youtube_url
                                    logger.info(f"Found YouTube video ID from iframe: {video_id}")
                                    break
                                    
                except Exception as e:
                    logger.warning(f"Could not extract video URL from embedded iframe: {str(e)}")
            
            return song_info
            
        except Exception as e:
            logger.error(f"Error getting song info for ID {song_id}: {str(e)}")
            raise

    def download_song(self, song_id, output_dir):
        """Download song files from USDB"""
        try:
            if not self.logged_in:
                self.login()
            
            # Get song info first
            song_info = self.get_song_info(song_id)
            
            # Create output directory
            os.makedirs(output_dir, exist_ok=True)
            
            # Download the song text file using POST request (like usdb_syncer)
            logger.info(f"Downloading song {song_id} text file")
            
            # Use POST request to gettxt endpoint with wd=1 parameter
            response = self.session.post(
                f"{self.base_url}/index.php",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                params={"link": "gettxt", "id": str(song_id)},
                data={"wd": "1"}
            )
            response.raise_for_status()
            
            # Parse the response to get the song text
            soup = BeautifulSoup(response.text, 'html.parser')
            textarea = soup.find('textarea')
            
            if not textarea or not textarea.string:
                raise Exception("No song text found in response")
            
            song_text = textarea.string
            
            # Clean song text (remove empty lines)
            # The text might be in one long line, so we need to split it properly
            # First, try to split by actual line breaks
            lines = song_text.split('\n')
            
            # If we only have one line, the text might be using \r\n or other separators
            if len(lines) == 1:
                # Try different line break patterns
                lines = song_text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
            
            # If we still have only one line, the text might be using different separators
            if len(lines) == 1:
                # Try to split by common patterns in UltraStar files
                # Look for patterns like ": 0 4 7" or "#ARTIST:" or "- 60"
                # Split by lines that start with :, #, -, or * (common UltraStar patterns)
                lines = re.split(r'\n(?=[:#\-*])', song_text)
                if len(lines) > 1:
                    # Add back the newlines that were removed by the split
                    lines = [lines[0]] + ['\n' + line for line in lines[1:]]
            
            # Remove empty lines (lines that are just whitespace)
            # Also remove \r characters that might be present
            # IMPORTANT: Only remove \r characters, preserve trailing spaces for UltraStar formatting
            non_empty_lines = [line.rstrip('\r') for line in lines if line.strip()]
            cleaned_song_text = '\n'.join(non_empty_lines)
            
            logger.info(f"Text cleaning: {len(lines)} original lines -> {len(non_empty_lines)} cleaned lines")
            
            # Debug: Show first few lines to verify splitting worked
            if len(lines) > 1:
                logger.info(f"First 5 lines: {lines[:5]}")
            else:
                logger.info(f"Still only 1 line, trying alternative splitting...")
                # Try splitting by common UltraStar patterns without regex
                if '#ARTIST:' in song_text:
                    # Split by #ARTIST:, #TITLE:, etc.
                    parts = song_text.split('#ARTIST:')
                    if len(parts) > 1:
                        lines = ['#ARTIST:' + parts[1]] + parts[2:] if len(parts) > 2 else ['#ARTIST:' + parts[1]]
                        logger.info(f"Split by #ARTIST: pattern: {len(lines)} lines")
            
            # Create filename based on artist and title
            artist = song_info.get('artist', 'Unknown').strip()
            title = song_info.get('title', 'Unknown').strip()
            
            # Clean filename (remove invalid characters)
            safe_artist = sanitize_filename(artist)
            safe_title = sanitize_filename(title)
            
            if safe_artist and safe_title and safe_artist != 'Unknown' and safe_title != 'Unknown':
                folder_name = f"{safe_artist} - {safe_title}"
                txt_filename = f"{safe_artist} - {safe_title}.txt"
            else:
                folder_name = f"USDB_{song_id}"
                txt_filename = f"usdb_{song_id}.txt"
            
            # Update output directory to use the new folder name
            final_output_dir = os.path.join(os.path.dirname(output_dir), folder_name)
            
            # Remove old directory if it exists
            if os.path.exists(output_dir):
                import shutil
                shutil.rmtree(output_dir)
                logger.info(f"Removed old directory: {output_dir}")
            
            os.makedirs(final_output_dir, exist_ok=True)
            
            # Save the song text file (remove existing file first)
            txt_path = os.path.join(final_output_dir, txt_filename)
            if os.path.exists(txt_path):
                os.remove(txt_path)
            
            # Write the cleaned text
            with open(txt_path, 'w', encoding='utf-8') as f:
                f.write(cleaned_song_text)
            
            # Verify the file was written correctly
            with open(txt_path, 'r', encoding='utf-8') as f:
                written_content = f.read()
                written_lines = written_content.split('\n')
                empty_lines = sum(1 for line in written_lines if not line.strip())
                logger.info(f"File verification: {len(written_lines)} lines written, {empty_lines} empty lines")
            
            logger.info(f"Saved song text to {txt_filename}")
            
            # Try to download cover image if available
            if song_info['cover_url'] and 'nocover' not in song_info['cover_url']:
                try:
                    logger.info(f"Downloading cover image from {song_info['cover_url']}")
                    cover_response = self.session.get(song_info['cover_url'])
                    cover_response.raise_for_status()
                    
                    # Determine file extension
                    cover_ext = 'jpg'
                    if 'png' in song_info['cover_url'].lower():
                        cover_ext = 'png'
                    elif 'gif' in song_info['cover_url'].lower():
                        cover_ext = 'gif'
                    
                    cover_filename = f"{safe_artist} - {safe_title}.{cover_ext}"
                    cover_path = os.path.join(final_output_dir, cover_filename)
                    
                    with open(cover_path, 'wb') as f:
                        f.write(cover_response.content)
                    
                    logger.info(f"Saved cover image to {cover_filename}")
                    
                except Exception as e:
                    logger.warning(f"Could not download cover image: {str(e)}")
            
            # Try to download YouTube video if available
            if song_info['video_url']:
                try:
                    logger.info(f"Downloading YouTube video from {song_info['video_url']}")
                    
                    # Use the same filename base as the text file
                    filename_base = f"{safe_artist} - {safe_title}"
                    downloaded_video = self.download_youtube_video(
                        song_info['video_url'], 
                        final_output_dir, 
                        filename_base
                    )
                    
                    if downloaded_video:
                        logger.info(f"Successfully downloaded video: {downloaded_video}")
                    else:
                        logger.warning("YouTube video download failed or no video found")
                        
                except Exception as e:
                    logger.warning(f"Could not download YouTube video: {str(e)}")
            
            # Note: Audio separation will be handled by the calling code (app.py)
            # to avoid code duplication and circular imports
            
            return {
                'success': True,
                'song_info': song_info,
                'output_dir': final_output_dir,
                'folder_name': folder_name,
                'files': [f for f in os.listdir(final_output_dir) if os.path.isfile(os.path.join(final_output_dir, f))]
            }
            
        except Exception as e:
            logger.error(f"Error downloading song {song_id}: {str(e)}")
            raise

    def download_youtube_video(self, youtube_url, output_dir, filename_base):
        """Download YouTube video using yt-dlp"""
        try:
            import yt_dlp
        except ImportError:
            logger.error("yt-dlp not installed")
            return None
        
        try:
            # Generate output filename with the same naming pattern
            output_filename = f"{filename_base}.%(ext)s"
            output_path = os.path.join(output_dir, output_filename)
            
            # Configure yt-dlp options with enhanced settings to bypass YouTube restrictions
            ydl_opts = {
                'outtmpl': output_path,
                'format': 'best[ext=mp4]/best[ext=webm]/best',
                'noplaylist': True,
                'extract_flat': False,
                'quiet': False,
                'no_warnings': False,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'extractor_args': {
                    'youtube': {
                        'player_client': ['android', 'ios'],  # Use mobile clients to bypass SABR streaming
                        'skip': ['dash', 'hls']
                    }
                }
            }
            
            logger.info(f"Downloading YouTube video: {youtube_url}")
            
            # Download the video
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=True)
                logger.info(f"YouTube download completed successfully")
                
                # Find the downloaded file
                files = os.listdir(output_dir)
                downloaded_video = None
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    name = os.path.splitext(file)[0].lower()
                    
                    if (ext in ['.mp4', '.webm'] and 
                        'hp2' not in name and 'hp5' not in name and
                        'vocals' not in name and 'instrumental' not in name and
                        'extracted' not in name and
                        filename_base.lower() in name.lower()):
                        downloaded_video = file
                        break
                
                if downloaded_video:
                    logger.info(f"Downloaded video: {downloaded_video}")
                    
                    # Normalize audio in the downloaded video
                    video_path = os.path.join(output_dir, downloaded_video)
                    logger.info(f"Starting audio normalization for: {video_path}")
                    
                    normalized_path = self.normalize_audio_in_video(video_path)
                    if normalized_path:
                        logger.info(f"Audio normalization completed successfully")
                    else:
                        logger.warning(f"Audio normalization failed, but video download was successful")
                    
                    return downloaded_video
                else:
                    logger.warning(f"Video download completed but no matching file found. Files: {files}")
                    return None
                    
        except Exception as e:
            logger.error(f"YouTube download failed: {str(e)}")
            return None

    def normalize_audio_in_video(self, video_path):
        """
        Normalize audio in video file using ffmpeg loudnorm filter
        """
        try:
            if not os.path.exists(video_path):
                logger.error(f"Video file not found: {video_path}")
                return None
            
            # Create temporary output file
            base_name = os.path.splitext(video_path)[0]
            extension = os.path.splitext(video_path)[1]
            temp_output = f"{base_name}_normalized_temp{extension}"
            
            logger.info(f"Normalizing audio in video: {video_path}")
            
            # Use ffmpeg with loudnorm filter for audio normalization
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-c:v', 'copy',  # Copy video stream without re-encoding
                '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',  # Audio normalization filter
                '-y',  # Overwrite output file if it exists
                temp_output
            ]
            
            logger.info(f"Running ffmpeg normalization command: {' '.join(cmd)}")
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            
            if result.returncode == 0:
                logger.info(f"Successfully normalized audio in video: {temp_output}")
                
                # Replace original video with normalized version
                try:
                    os.replace(temp_output, video_path)
                    logger.info(f"Replaced original video with normalized version: {video_path}")
                    return video_path
                except Exception as e:
                    logger.error(f"Error replacing original video: {e}")
                    return temp_output
            else:
                logger.error(f"ffmpeg normalization failed with return code {result.returncode}")
                logger.error(f"ffmpeg stderr: {result.stderr}")
                # Clean up temp file if it exists
                if os.path.exists(temp_output):
                    os.remove(temp_output)
                return None
                
        except subprocess.TimeoutExpired:
            logger.error("ffmpeg normalization command timed out")
            # Clean up temp file if it exists
            if 'temp_output' in locals() and os.path.exists(temp_output):
                os.remove(temp_output)
            return None
        except Exception as e:
            logger.error(f"Error normalizing audio in video: {e}")
            # Clean up temp file if it exists
            if 'temp_output' in locals() and os.path.exists(temp_output):
                os.remove(temp_output)
            return None


    def search_songs(self, interpret="", title="", limit=20):
        """
        Search for songs on USDB using interpret and/or title
        Based on the usdb_find_ids.py script functionality
        """
        if not self.logged_in:
            raise RuntimeError("Must be logged in to search songs")
        
        logger.info(f"Searching USDB: interpret='{interpret}', title='{title}', limit={limit}")
        
        # Use the list page endpoint
        list_url = f"{self.base_url}/?link=list"
        
        # Prepare search data
        search_data = {
            "interpret": interpret,
            "title": title,
            "limit": str(limit),
            "start": "0"
        }
        
        try:
            response = self.session.post(
                list_url,
                data=search_data,
                headers={
                    **self.session.headers,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Referer": list_url
                },
                timeout=30
            )
            response.raise_for_status()
            
            # Check if still logged in
            if "You are not logged in" in response.text:
                logger.error("Session expired during search")
                raise RuntimeError("Session expired, not logged in")
            
            # Parse the results
            songs = self._parse_search_results(response.text)
            
            logger.info(f"Found {len(songs)} songs")
            return songs
            
        except requests.RequestException as e:
            logger.error(f"Request error during search: {e}")
            raise RuntimeError(f"Search request failed: {e}")
        except Exception as e:
            logger.error(f"Error during search: {e}")
            raise RuntimeError(f"Search failed: {e}")
    
    def _parse_search_results(self, html):
        """
        Parse search results from HTML response
        Based on the parse_list function from usdb_find_ids.py
        """
        soup = BeautifulSoup(html, 'html.parser')
        songs = []
        
        # Header words to filter out
        header_words = {"artist", "interpret", "title", "song"}
        
        for tr in soup.select("tr"):
            # Skip header rows
            if tr.find("th"):
                continue
            
            # Check if there's a detail link (song exists)
            a_detail = tr.select_one('a[href*="link=detail"][href*="id="]')
            if not a_detail:
                continue
            
            # Extract song ID
            href = a_detail.get("href") or ""
            m = re.search(r"id=(\d+)", href)
            if not m:
                continue
            
            song_id = int(m.group(1))
            title = a_detail.get_text(strip=True)
            
            # Extract artist - try multiple strategies
            artist = None
            
            # Strategy 1: Look for interpret link in the same row
            a_interpret = None
            for a in tr.select('a[href]'):
                h = a.get("href") or ""
                if "interpret=" in h:
                    a_interpret = a
                    break
            
            if a_interpret:
                artist = a_interpret.get_text(strip=True)
            
            # Strategy 2: Look at cell next to title cell
            if not artist:
                title_td = a_detail.find_parent("td")
                cand_td = title_td.find_previous_sibling("td") if title_td else None
                if cand_td:
                    # Check if there's an interpret/artist link in the cell
                    link_in_cand = cand_td.select_one('a[href*="interpret="], a[href*="link=artist"]')
                    if link_in_cand:
                        artist = link_in_cand.get_text(strip=True)
                    else:
                        text = " ".join(cand_td.get_text(" ", strip=True).split())
                        if text.strip().lower() not in header_words and text != title:
                            artist = text
            
            # Strategy 3: Look for explicit artist link
            if not artist:
                a_artist = tr.select_one('a[href*="link=artist"]')
                artist = a_artist.get_text(strip=True) if a_artist else ""
            
            # Create song object
            song = {
                "id": song_id,
                "artist": artist or "Unknown Artist",
                "title": title,
                "url": f"{self.base_url}/?link=detail&id={song_id}"
            }
            
            songs.append(song)
        
        return songs


def download_from_usdb_improved(song_id, username, password, output_dir):
    """Convenience function using improved scraper"""
    scraper = USDBScraperImproved(username, password)
    return scraper.download_song(song_id, output_dir)
