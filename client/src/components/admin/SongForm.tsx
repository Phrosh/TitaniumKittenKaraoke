import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import getFirstLetter from '../../utils/getFirstLetter';
import {adminAPI} from '../../services/api';
import SmallModeBadge from '../shared/SmallModeBadge';

// Reusable Song Form Component
interface SongFormProps {
    singerName: string;
    artist: string;
    title: string;
    youtubeUrl: string;
    youtubeMode?: 'karaoke' | 'magic';
    withBackgroundVocals: boolean;
    onSingerNameChange: (value: string) => void;
    onYoutubeUrlChange: (value: string) => void;
    onYoutubeModeChange?: (mode: 'karaoke' | 'magic') => void;
    onWithBackgroundVocalsChange: (checked: boolean) => void;
    showSongList?: boolean;
    songList?: any[];
    onSongSelect?: (song: any) => void;
    usdbResults?: any[];
    usdbLoading?: boolean;
    songData: {artist: string, title: string};
    setSongData: (data: {artist: string, title: string, singerName: string, youtubeUrl: string, youtubeMode?: 'karaoke' | 'magic'}) => void;
    setSongSearchTerm: (term: string) => void;
    setUsdbResults: (results: any[]) => void;
    setUsdbLoading: (loading: boolean) => void;
    hideYoutubeModeOptions?: boolean;
    cacheInfo?: any;
  }

const SongForm: React.FC<SongFormProps> = ({
    singerName,
    artist,
    title,
    youtubeUrl,
    youtubeMode = 'karaoke',
    withBackgroundVocals,
    onSingerNameChange,
    onYoutubeUrlChange,
    onYoutubeModeChange,
    onWithBackgroundVocalsChange,
    showSongList = false,
    songList = [],
    onSongSelect,
    usdbResults = [],
    songData,
    usdbLoading = false,
    setSongData,
    setSongSearchTerm,
    setUsdbResults,
    setUsdbLoading,
    hideYoutubeModeOptions = false,
    cacheInfo
  }) => {
    const { t } = useTranslation();
    const [addSongUsdbTimeout, setAddSongUsdbTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced USDB search
    const triggerUSDBSearch = (artist: string, title: string) => {
        // Clear existing timeout
        if (addSongUsdbTimeout) {
        clearTimeout(addSongUsdbTimeout);
        }

        // Show loading state immediately
        if (artist.trim() || title.trim()) {
        setUsdbLoading(true);
        setUsdbResults([]);
        }

        // Set new timeout
        const timeout = setTimeout(() => {
        performUSDBSearch(artist, title);
        }, 2000); // 2 seconds delay

        setAddSongUsdbTimeout(timeout);
    };
    
    // Cleanup timeout on unmount
    React.useEffect(() => {
      return () => {
        if (addSongUsdbTimeout) {
          clearTimeout(addSongUsdbTimeout);
        }
      };
    }, [addSongUsdbTimeout]);
  
    // USDB Search with delay
    const performUSDBSearch = async (artist: string, title: string) => {
      if (!artist.trim() && !title.trim()) {
        setUsdbResults([]);
        return;
      }
  
      setUsdbLoading(true);
      try {
        const response = await adminAPI.searchUSDB(
          artist.trim() || undefined,
          title.trim() || undefined,
          100
        );
  
        const songs = response.data.songs || [];
        setUsdbResults(songs);
      } catch (error) {
        console.error('Error searching USDB:', error);
        setUsdbResults([]);
      } finally {
        setUsdbLoading(false);
      }
    };
    
    return (
      <>
        {/* Singer Name */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            {t('songForm.singerName')}:
          </label>
          <input
            type="text"
            placeholder={t('songForm.singerNamePlaceholder')}
            value={singerName}
            onChange={(e) => onSingerNameChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>
  
        {/* Artist and Title */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          marginBottom: '20px',
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              {t('songForm.artist')}
            </label>
            <input
              type="text"
              placeholder={t('songForm.artistPlaceholder')}
              value={artist}
              onChange={(e) => {
                const value = e.target.value;
                setSongData(prev => ({ ...prev, artist: value }));
                setSongSearchTerm(value);
                triggerUSDBSearch(value, songData.title);
              }}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              {t('songForm.title')}
            </label>
            <input
              type="text"
              placeholder={t('songForm.titlePlaceholder')}
              value={title}
              onChange={(e) => {
                const value = e.target.value;
                setSongData(prev => ({ ...prev, title: value }));
                setSongSearchTerm(value);
                triggerUSDBSearch(songData.artist, value);
              }}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>
  
        {/* YouTube Link */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '20px',
          gap: '15px'
        }}>
          <div style={{ 
            flex: 1, 
            height: '1px', 
            backgroundColor: '#ddd' 
          }}></div>
          <span style={{ 
            color: '#666', 
            fontSize: '14px', 
            fontWeight: '500' 
          }}>
            {t('songForm.or')}
          </span>
          <div style={{ 
            flex: 1, 
            height: '1px', 
            backgroundColor: '#ddd' 
          }}></div>
        </div>
  
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: '500',
            color: '#333'
          }}>
            {t('songForm.youtubeLink')}
          </label>
          <input
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => onYoutubeUrlChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Cache Status Display */}
        {cacheInfo && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            backgroundColor: '#e8f5e8',
            border: '1px solid #4caf50',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#2e7d32' }}>
              ✅ {t('songForm.songFoundAs')}:
            </span>
            <SmallModeBadge mode="" modes={cacheInfo.modes} />
          </div>
        )}

        {youtubeUrl && !hideYoutubeModeOptions && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
              {t('modals.editSong.youtubeMode')}:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="youtubeMode"
                  value="karaoke"
                  checked={youtubeMode === 'karaoke'}
                  onChange={(e) => onYoutubeModeChange?.(e.target.value as 'karaoke' | 'magic')}
                />
                <span>{t('modals.editSong.youtubeModeKaraoke')}</span>
                <SmallModeBadge mode="youtube" modes={[]} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="youtubeMode"
                  value="magic"
                  checked={youtubeMode === 'magic'}
                  onChange={(e) => onYoutubeModeChange?.(e.target.value as 'karaoke' | 'magic')}
                />
                <span>{t('modals.editSong.youtubeModeMagic')}</span>
                <SmallModeBadge mode="" modes={['magic-youtube']} />
              </label>
            </div>
          </div>
        )}
  
        {/* Background Vocals Checkbox */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={withBackgroundVocals}
              onChange={(e) => onWithBackgroundVocalsChange(e.target.checked)}
              style={{ transform: 'scale(1.2)' }}
            />
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#333' }}>
              {t('songForm.withBackgroundVocals')}
            </span>
          </label>
        </div>
  
        {/* Song List */}
        {showSongList && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#333'
            }}>
              {t('songForm.songList')}
            </label>
            
            <div style={{ display: 'flex', padding: '8px 10px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '10px', fontSize: '12px', fontWeight: '600', color: '#666' }}>
              <div style={{ flex: 1, paddingRight: '10px' }}>{t('songForm.interpret')}</div>
              <div style={{ flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>{t('songForm.songTitle')}</div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px', border: '1px solid #ddd', borderRadius: '6px' }}>
              {/* USDB Results Section */}
              {usdbResults.length > 0 && (
                <div>
                  <div style={{
                    position: 'sticky',
                    top: 0,
                    background: '#28a745',
                    color: 'white',
                    padding: '8px 15px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    zIndex: 10,
                    borderBottom: '2px solid #218838'
                  }}>
                    {t('songForm.usdb', { count: usdbResults.length })}
                  </div>
                  {usdbResults.map((song, index) => (
                    <div
                      key={`usdb-${song.id}`}
                      onClick={() => onSongSelect?.(song)}
                      style={{
                        padding: '10px',
                        border: '1px solid #eee',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        backgroundColor: artist === song.artist && title === song.title ? '#e3f2fd' : 'white'
                      }}
                      onMouseEnter={(e) => {
                        if (!(artist === song.artist && title === song.title)) {
                          e.currentTarget.style.background = '#f8f9fa';
                          e.currentTarget.style.borderColor = '#667eea';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(artist === song.artist && title === song.title)) {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.borderColor = '#eee';
                        }
                      }}
                    >
                      <div style={{ fontWeight: '600', color: '#333', flex: 1, paddingRight: '10px' }}>
                        {song.artist}
                      </div>
                      <div style={{ color: '#666', fontSize: '14px', flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>
                        {song.title}
                      </div>
                    </div>
                  ))}
                </div>
              )}
  
              {/* Loading indicator for USDB search */}
              {usdbLoading && (
                <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                  🔍 {t('songForm.usdbSearching')}
                </div>
              )}
  
              {/* Local Songs Section */}
              {songList.length > 0 && getFirstLetter && (() => {
                // Filter songs based on current artist and title values
                const artistTerm = (artist || '').toLowerCase().trim();
                const titleTerm = (title || '').toLowerCase().trim();
                
                const filteredSongs = songList.filter(song => {
                  // If no search terms at all, show all songs
                  if (!artistTerm && !titleTerm) return true;
                  
                  // Search in artist, title, or combined
                  const songArtist = song.artist.toLowerCase();
                  const songTitle = song.title.toLowerCase();
                  const songCombined = `${songArtist} - ${songTitle}`;
                  
                  // Check if song matches any of the search criteria
                  let matches = false;
                  
                  // If artist term exists, check if song artist contains it
                  if (artistTerm) {
                    matches = matches || songArtist.includes(artistTerm) || songCombined.includes(artistTerm);
                  }
                  
                  // If title term exists, check if song title contains it
                  if (titleTerm) {
                    matches = matches || songTitle.includes(titleTerm) || songCombined.includes(titleTerm);
                  }
                  
                  // Cross-search: artist term in title, title term in artist
                  if (artistTerm && titleTerm) {
                    matches = matches || songArtist.includes(titleTerm) || songTitle.includes(artistTerm);
                  }
                  
                  return matches;
                });
                
                // Group filtered songs by first letter of artist
                const groupedSongs = filteredSongs.reduce((groups, song) => {
                  const letter = getFirstLetter(song.artist);
                  if (!groups[letter]) {
                    groups[letter] = [];
                  }
                  groups[letter].push(song);
                  return groups;
                }, {} as Record<string, typeof filteredSongs>);
                
                const sortedGroups = Object.keys(groupedSongs).sort();
                
                return (
                  <>
                    {sortedGroups.length > 0 ? sortedGroups.map((letter) => (
                      <div key={letter}>
                        <div style={{
                          position: 'sticky',
                          top: 0,
                          background: '#adb5bd',
                          color: 'white',
                          padding: '8px 15px',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          zIndex: 10,
                          borderBottom: '2px solid #9ca3af'
                        }}>
                          {letter}
                        </div>
                        {groupedSongs[letter].map((song, index) => (
                          <div
                            key={`${letter}-${index}`}
                            onClick={() => onSongSelect?.(song)}
                            style={{
                              padding: '10px',
                              border: '1px solid #eee',
                              borderRadius: '8px',
                              marginBottom: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              backgroundColor: artist === song.artist && title === song.title ? '#e3f2fd' : 'white'
                            }}
                            onMouseEnter={(e) => {
                              if (!(artist === song.artist && title === song.title)) {
                                e.currentTarget.style.background = '#f8f9fa';
                                e.currentTarget.style.borderColor = '#667eea';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!(artist === song.artist && title === song.title)) {
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.borderColor = '#eee';
                              }
                            }}
                          >
                            <div style={{ fontWeight: '600', color: '#333', flex: 1, paddingRight: '10px' }}>
                              {song.artist}
                            </div>
                            <div style={{ color: '#666', fontSize: '14px', flex: 1, paddingLeft: '10px', borderLeft: '1px solid #eee' }}>
                              {song.title}
                            </div>
                          </div>
                        ))}
                      </div>
                    )) : (
                      <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
                        {t('songForm.noLocalSongs')}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </>
    );
  };
  
export default SongForm;