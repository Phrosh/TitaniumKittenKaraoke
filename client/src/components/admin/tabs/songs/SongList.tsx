import React, { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminAPI, songAPI } from '../../../../services/api';
import toast from 'react-hot-toast';
import {
    SettingsCard,
    SettingsLabel,
    SettingsDescription
} from '../../../shared/style';
import Button from '../../../shared/Button';
import getFirstLetter from '../../../../utils/getFirstLetter';
import { getProcessingButtonState } from '../../../../utils/helper';
import DeleteModal from './DeleteModal';
import RenameModal from './RenameModal';
import YoutubeDownloadModal from './YoutubeDownloadModal';
import SmallModeBadge from '../../../shared/SmallModeBadge';
import DownloadStatusBadge from '../../../shared/DownloadStatusBadge';
import { DownloadStatus } from '../../../../utils/helper';
import websocketService from '../../../../services/websocket';

interface SongListProps {
    songTab: 'all' | 'visible' | 'invisible';
    songSearchTerm: string;
    fetchDashboardData: () => void;
    songs: any[];
    invisibleSongs: any[];
    setInvisibleSongs: (invisibleSongs: any[]) => void;
    fetchSongs: () => void;
    ultrastarAudioSettings: any;
    setUltrastarAudioSettings: (ultrastarAudioSettings: any) => void;
}

const SongList: React.FC<SongListProps> = ({
    songTab,
    songSearchTerm,
    fetchDashboardData,
    songs,
    invisibleSongs,
    setInvisibleSongs,
    fetchSongs,
    ultrastarAudioSettings,
    setUltrastarAudioSettings,
}) => {
    const { t } = useTranslation();
    
    const [actionLoading, setActionLoading] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameSong, setRenameSong] = useState<any>(null);
    const [processingSongs, setProcessingSongs] = useState<Set<string>>(new Set());
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteSong, setDeleteSong] = useState<any>(null);
    const [songStatuses, setSongStatuses] = useState<Map<string, DownloadStatus>>(new Map());

    const [showYouTubeDialog, setShowYouTubeDialog] = useState(false);
    const [selectedSongForDownload, setSelectedSongForDownload] = useState<any>(null);

     const handleCloseYouTubeDialog = () => {
        setShowYouTubeDialog(false);
        setSelectedSongForDownload(null);
    };

    const handleProcessWithoutVideo = async () => {
        if (!selectedSongForDownload) {
          toast.error(t('songList.noSongSelected'));
          return;
        }
        
        const songKey = `${selectedSongForDownload.artist}-${selectedSongForDownload.title}`;
        const folderName = selectedSongForDownload.folderName || `${selectedSongForDownload.artist} - ${selectedSongForDownload.title}`;
        
        // Close dialog first
        handleCloseYouTubeDialog();
        
        // Start processing without video
        await startNormalProcessing(selectedSongForDownload, songKey, folderName);
      };

    const fetchInvisibleSongs = useCallback(async () => {
        try {
            const response = await adminAPI.getInvisibleSongs();
            setInvisibleSongs(response.data.invisibleSongs || []);
        } catch (error) {
            console.error('Error fetching invisible songs:', error);
        }
    }, []);

    // Load songs when songs tab is active
    useEffect(() => {
        fetchSongs();
        fetchInvisibleSongs();
    }, [fetchSongs, fetchInvisibleSongs]);

    // WebSocket listener for processing status updates
    useEffect(() => {
        const handleProcessingStatus = (data: { id?: number; artist?: string; title?: string; status: DownloadStatus }) => {
            console.log('🛰️ SongList: processing-status received via WS:', data);
            
            // Try to find the song by ID first, then by artist/title
            let songKey = null;
            
            if (data.id) {
                // Find song by ID in the songs list
                const songById = songs.find(song => song.id === data.id);
                if (songById) {
                    songKey = `${songById.artist}-${songById.title}`;
                    console.log('🛰️ SongList: Found song by ID:', songById.artist, songById.title);
                }
            }
            
            if (!songKey && data.artist && data.title) {
                songKey = `${data.artist}-${data.title}`;
                console.log('🛰️ SongList: Using artist/title:', data.artist, data.title);
            }
            
            if (songKey) {
                setSongStatuses(prev => {
                    const newMap = new Map(prev);
                    newMap.set(songKey, data.status);
                    return newMap;
                });
                
                // Also update processingSongs for active statuses
                if (data.status && !['finished', 'ready', 'failed'].includes(data.status)) {
                    setProcessingSongs(prev => new Set(prev).add(songKey));
                } else {
                    setProcessingSongs(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(songKey);
                        return newSet;
                    });
                }
                
                console.log('🛰️ SongList: Updated status for', songKey, 'to', data.status);
            } else {
                console.log('🛰️ SongList: Could not find song for data:', data);
            }
        };

        websocketService.on('processing-status', handleProcessingStatus);

        return () => {
            websocketService.off('processing-status', handleProcessingStatus);
        };
    }, [songs]); // Add songs dependency

    const handleUltrastarAudioChange = async (song: any, audioPreference: string) => {
        setActionLoading(true);
        try {
            const songKey = `${song.artist}-${song.title}`;

            if (audioPreference === 'choice') {
                // Remove setting (default to choice)
                await adminAPI.removeUltrastarAudioSetting(song.artist, song.title);
                setUltrastarAudioSettings(prev => {
                    const newSettings = { ...prev };
                    delete newSettings[songKey];
                    return newSettings;
                });
                toast.success(t('songList.audioSettingChoice', { artist: song.artist, title: song.title }));
            } else {
                // Set specific preference
                await adminAPI.setUltrastarAudioSetting(song.artist, song.title, audioPreference);
                setUltrastarAudioSettings(prev => ({
                    ...prev,
                    [songKey]: audioPreference
                }));
                const preferenceText = audioPreference === 'hp2' ? t('songList.background') : t('songList.instrumental');
                toast.success(t('songList.audioSettingBackground', { artist: song.artist, title: song.title, preference: preferenceText }));
            }
        } catch (error: any) {
            console.error('Error updating ultrastar audio setting:', error);
            toast.error(error.response?.data?.message || t('songList.audioSettingError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRenameSong = (song: any) => {
        setRenameSong(song);
        // setRenameData({
        //     newArtist: song.artist,
        //     newTitle: song.title
        // });
        setShowRenameModal(true);
    };

    const handleToggleSongVisibility = async (song: any) => {
        // Check if song is currently in invisible_songs table
        const isInInvisibleTable = invisibleSongs.some(invisible =>
            invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
            invisible.title.toLowerCase() === song.title.toLowerCase()
        );

        if (isInInvisibleTable) {
            // Song is in invisible_songs table - remove it to make it visible
            const invisibleSong = invisibleSongs.find(invisible =>
                invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                invisible.title.toLowerCase() === song.title.toLowerCase()
            );

            setActionLoading(true);
            try {
                await adminAPI.removeFromInvisibleSongs(invisibleSong.id);
                toast.success(t('songList.songMadeVisible', { artist: song.artist, title: song.title }));
                await fetchInvisibleSongs();
            } catch (error: any) {
                console.error('Error removing from invisible songs:', error);
                toast.error(error.response?.data?.message || t('songList.visibilityError'));
            } finally {
                setActionLoading(false);
            }
        } else {
            // Song is not in invisible_songs table - add it to make it invisible
            setActionLoading(true);
            try {
                await adminAPI.addToInvisibleSongs(song.artist, song.title);
                toast.success(t('songList.songMadeInvisible', { artist: song.artist, title: song.title }));
                await fetchInvisibleSongs();
            } catch (error: any) {
                console.error('Error adding to invisible songs:', error);
                toast.error(error.response?.data?.message || t('songList.visibilityError'));
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleStartProcessing = async (song: any) => {
        const songKey = `${song.artist}-${song.title}`;

        try {
            const folderName = song.folderName || `${song.artist} - ${song.title}`;

            // Use modular processing for all song types
            await startModularProcessing(song, songKey, folderName);

        } catch (error: any) {
            console.error('Error starting modular processing:', error);
            toast.error(error.response?.data?.error || t('songList.modularProcessingError'));
        }
    };

    const startModularProcessing = async (song: any, songKey: string, folderName: string) => {
        // Mark song as processing
        setProcessingSongs(prev => new Set(prev).add(songKey));

        try {
            // Determine song type
            let songType = 'ultrastar';
            if (song.modes?.includes('magic-songs')) {
                songType = 'magic-songs';
            } else if (song.modes?.includes('magic-videos')) {
                songType = 'magic-videos';
            }

            const response = await songAPI.modularProcess(folderName, songType);

            if (response.data.success) {
                toast.success(t('songList.modularProcessingStarted', { artist: song.artist, title: song.title }));
                console.log('Modular processing started:', response.data);
                // Keep in processing state - will be removed later when job completes
            } else {
                toast.error(response.data.error || t('songList.modularProcessingError'));
                // Remove from processing state on error
                setProcessingSongs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(songKey);
                    return newSet;
                });
            }
        } catch (error: any) {
            console.error('Error starting modular processing:', error);
            toast.error(error.response?.data?.error || t('songList.modularProcessingError'));
            // Remove from processing state on error
            setProcessingSongs(prev => {
                const newSet = new Set(prev);
                newSet.delete(songKey);
                return newSet;
            });
        }
    };

    const startNormalProcessing = async (song: any, songKey: string, folderName: string) => {
        // Mark song as processing
        setProcessingSongs(prev => new Set(prev).add(songKey));

        try {
            const response = await songAPI.processUltrastarSong(folderName);

            if (response.data.status === 'no_processing_needed') {
                toast(t('songList.noProcessingNeeded'), { icon: 'ℹ️' });
                // Remove from processing state since no processing was needed
                setProcessingSongs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(songKey);
                    return newSet;
                });
            } else {
                toast.success(t('songList.processingStarted', { artist: song.artist, title: song.title }));
                console.log('Processing started:', response.data);
                // Keep in processing state - will be removed later when job completes
            }
        } catch (error: any) {
            console.error('Error starting processing:', error);
            toast.error(error.response?.data?.error || t('songList.processingError'));
            // Remove from processing state on error
            setProcessingSongs(prev => {
                const newSet = new Set(prev);
                newSet.delete(songKey);
                return newSet;
            });
        }
    };

    const startMagicSongProcessing = async (song: any, songKey: string, folderName: string) => {
        // Mark song as processing
        setProcessingSongs(prev => new Set(prev).add(songKey));

        try {
            const response = await songAPI.processMagicSong(folderName);

            if (response.data.success) {
                toast.success(t('songList.magicProcessingStarted', { artist: song.artist, title: song.title }));
                console.log('Magic song processing started:', response.data);
                // Keep in processing state - will be removed later when job completes
            } else {
                toast.error(response.data.error || t('songList.magicProcessingError'));
                // Remove from processing state on error
                setProcessingSongs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(songKey);
                    return newSet;
                });
            }
        } catch (error: any) {
            console.error('Error starting magic song processing:', error);
            toast.error(error.response?.data?.error || t('songList.magicProcessingError'));
            // Remove from processing state on error
            setProcessingSongs(prev => {
                const newSet = new Set(prev);
                newSet.delete(songKey);
                return newSet;
            });
        }
    };

    const startMagicVideoProcessing = async (song: any, songKey: string, folderName: string) => {
        // Mark song as processing
        setProcessingSongs(prev => new Set(prev).add(songKey));

        try {
            const response = await songAPI.processMagicVideo(folderName);

            if (response.data.success) {
                toast.success(t('songList.magicProcessingStarted', { artist: song.artist, title: song.title }));
                console.log('Magic video processing started:', response.data);
                // Keep in processing state - will be removed later when job completes
            } else {
                toast.error(response.data.error || t('songList.magicProcessingError'));
                // Remove from processing state on error
                setProcessingSongs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(songKey);
                    return newSet;
                });
            }
        } catch (error: any) {
            console.error('Error starting magic video processing:', error);
            toast.error(error.response?.data?.error || t('songList.magicProcessingError'));
            // Remove from processing state on error
            setProcessingSongs(prev => {
                const newSet = new Set(prev);
                newSet.delete(songKey);
                return newSet;
            });
        }
    };

    const handleRecreateSong = async (song: any) => {
        const songKey = `${song.artist}-${song.title}`;
        const folderName = song.folderName || `${song.artist} - ${song.title}`;

        // Mark song as processing
        setProcessingSongs(prev => new Set(prev).add(songKey));

        try {
            // Determine song type
            let songType = 'magic-songs';
            if (song.modes?.includes('magic-videos')) {
                songType = 'magic-videos';
            } else if (song.modes?.includes('magic-youtube')) {
                songType = 'magic-youtube';
            }

            const response = await songAPI.recreateSong(folderName, songType);

            if (response.data.success) {
                toast.success(t('songList.recreateStarted', { artist: song.artist, title: song.title }));
                console.log('Recreate started:', response.data);
                // Keep in processing state - will be removed later when job completes
            } else {
                toast.error(response.data.error || t('songList.recreateError'));
                // Remove from processing state on error
                setProcessingSongs(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(songKey);
                    return newSet;
                });
            }
        } catch (error: any) {
            console.error('Error starting recreate:', error);
            toast.error(error.response?.data?.error || t('songList.recreateError'));
            // Remove from processing state on error
            setProcessingSongs(prev => {
                const newSet = new Set(prev);
                newSet.delete(songKey);
                return newSet;
            });
        }
    };

    const handleTestSong = async (song: { artist: string; title: string; modes?: string[]; youtubeUrl?: string }) => {
        setActionLoading(true);

        try {
            // Determine the best mode and URL for the song
            let mode = 'youtube';
            let youtubeUrl = song.youtubeUrl;

            if (song.modes?.includes('ultrastar')) {
                mode = 'ultrastar';
                youtubeUrl = `/api/ultrastar/${encodeURIComponent(`${song.artist} - ${song.title}`)}`;
            } else if (song.modes?.includes('file')) {
                mode = 'file';
                youtubeUrl = song.youtubeUrl || `${song.artist} - ${song.title}`;
            } else if (song.modes?.includes('server_video')) {
                mode = 'server_video';
                youtubeUrl = song.youtubeUrl || `/api/videos/${encodeURIComponent(`${song.artist} - ${song.title}`)}`;
            }

            const response = await adminAPI.testSong({
                artist: song.artist,
                title: song.title,
                mode: mode,
                youtubeUrl: youtubeUrl
            });

            toast.success(t('songList.testSongStarted', { artist: song.artist, title: song.title }));
            console.log('Test song started:', response.data);

            // Optionally refresh the dashboard to show updated current song
            fetchDashboardData();

        } catch (error: any) {
            console.error('Error testing song:', error);
            toast.error(error.response?.data?.message || t('songList.testSongError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteSongFromLibrary = (song: any) => {
        setDeleteSong(song);
        setShowDeleteModal(true);
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
        setDeleteSong(null);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteSong) {
            return;
        }

        setActionLoading(true);
        try {
            const response = await adminAPI.deleteSong(
                deleteSong.artist,
                deleteSong.title
            );

            if (response.data.success) {
                // Refresh songs list
                await fetchSongs();
                setShowDeleteModal(false);
                setDeleteSong(null);
                toast.success(t('songList.songDeleted', { artist: deleteSong.artist, title: deleteSong.title }));
            } else {
                console.error('Delete failed:', response.data.message);
                toast.error(response.data.message || t('songList.deleteError'));
            }
        } catch (error: any) {
            console.error('Error deleting song:', error);
            toast.error(error.response?.data?.message || t('songList.deleteError'));
        } finally {
            setActionLoading(false);
        }
    };

    const handleRenameCancel = () => {
        setShowRenameModal(false);
        setRenameSong(null);
      };

      const handleRenameConfirm = async (renameData: { newArtist: string; newTitle: string }) => {
        if (!renameSong || !renameData.newArtist.trim() || !renameData.newTitle.trim()) {
          return;
        }
    
        setActionLoading(true);
        try {
          const response = await adminAPI.renameSong(
            renameSong.artist,
            renameSong.title,
            renameData.newArtist.trim(),
            renameData.newTitle.trim()
          );
          
          if (response.data.success) {
            // Refresh songs list
            await fetchSongs();
            setShowRenameModal(false);
            setRenameSong(null);
            // setRenameData({ newArtist: '', newTitle: '' });
            toast.success(t('songList.songRenamed', { oldArtist: renameSong.artist, oldTitle: renameSong.title, newArtist: renameData.newArtist.trim(), newTitle: renameData.newTitle.trim() }));
          } else {
            console.error('Rename failed:', response.data.message);
            toast.error(response.data.message || t('songList.renameError'));
          }
        } catch (error: any) {
          console.error('Error renaming song:', error);
          toast.error(error.response?.data?.message || t('songList.renameError'));
        } finally {
          setActionLoading(false);
        }
      };

    return <>
        <SettingsCard>
            <SettingsLabel>
                {songTab === 'all' && t('songList.allSongsLabel', { count: songs.length })}
                {songTab === 'visible' && t('songList.visibleSongsLabel', { count: songs.filter(song => !invisibleSongs.some(invisible =>
                    invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                    invisible.title.toLowerCase() === song.title.toLowerCase()
                )).length })}
                {songTab === 'invisible' && t('songList.invisibleSongsLabel', { count: songs.filter(song => invisibleSongs.some(invisible =>
                    invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                    invisible.title.toLowerCase() === song.title.toLowerCase()
                )).length })}
            </SettingsLabel>
            {songs.length === 0 ? (
                <div style={{ color: '#666', fontStyle: 'italic' }}>
                    {t('songList.noSongsFound')}
                </div>
            ) : (() => {
                // Filter songs based on tab and search term
                let filteredSongs = songs;

                // Apply tab filter
                if (songTab === 'visible') {
                    filteredSongs = songs.filter(song => !invisibleSongs.some(invisible =>
                        invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                        invisible.title.toLowerCase() === song.title.toLowerCase()
                    ));
                } else if (songTab === 'invisible') {
                    filteredSongs = songs.filter(song => invisibleSongs.some(invisible =>
                        invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                        invisible.title.toLowerCase() === song.title.toLowerCase()
                    ));
                }

                // Apply search filter
                filteredSongs = filteredSongs.filter(song =>
                    !songSearchTerm ||
                    song.title.toLowerCase().includes(songSearchTerm.toLowerCase()) ||
                    song.artist?.toLowerCase().includes(songSearchTerm.toLowerCase())
                );

                // Group songs by first letter of artist
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
                    <div style={{ marginTop: '10px', maxHeight: '500px', overflowY: 'auto' }}>
                        {sortedGroups.map((letter) => (
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
                                {groupedSongs[letter].map((song) => {
                                    const wsStatus = songStatuses.get(`${song.artist}-${song.title}`);
                                    const apiStatus = song.download_status || song.status;
                                    const processingStatus = wsStatus || apiStatus;
                                    const isProcessing = processingSongs.has(`${song.artist}-${song.title}`);
                                    const hasActiveStatus = processingStatus && !['finished', 'ready', 'failed'].includes(processingStatus);
                                    
                                    // Check if processing is needed (red border condition)
                                    const buttonState = getProcessingButtonState(song);
                                    const shouldShowButton = buttonState.enabled && 
                                        (processingStatus === 'failed' || !processingStatus);
                                    const processingNeeded = shouldShowButton;
                                    
                                    const shouldDisableButtons = actionLoading || isProcessing || hasActiveStatus;
                                    const shouldDisableTestButton = shouldDisableButtons || processingNeeded;
                                    const isInvisible = invisibleSongs.some(invisible =>
                                        invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                                        invisible.title.toLowerCase() === song.title.toLowerCase()
                                    );

                                    // Determine border color based on status
                                    let borderColor = '#eee'; // default
                                    let borderWidth = '1px';
                                    
                                    if (hasActiveStatus || isProcessing) {
                                        // Yellow border for active processing
                                        borderColor = '#ffc107';
                                        borderWidth = '2px';
                                    } else if (processingStatus === 'failed') {
                                        // Red border for failed status
                                        borderColor = '#dc3545';
                                        borderWidth = '2px';
                                    } else {
                                        // Check if processing button should be shown (processing needed)
                                        const buttonState = getProcessingButtonState(song);
                                        const shouldShowButton = buttonState.enabled && 
                                            (processingStatus === 'failed' || !processingStatus);
                                        
                                        if (shouldShowButton) {
                                            // Red border when processing button is shown (processing needed)
                                            borderColor = '#dc3545';
                                            borderWidth = '2px';
                                        }
                                    }
                                    
                                    
                                    return (
                                        <div
                                            key={`${song.artist}-${song.title}`}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                padding: '12px',
                                                border: `${borderWidth} solid ${borderColor}`,
                                                borderRadius: '6px',
                                                marginBottom: '8px',
                                                background: isInvisible ? '#f8f9fa' : '#fff',
                                                opacity: isInvisible ? 0.7 : 1,
                                                gap: '12px',
                                                transition: 'border-color 0.2s ease, border-width 0.2s ease'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={!isInvisible}
                                                onChange={() => handleToggleSongVisibility(song)}
                                                disabled={actionLoading}
                                                style={{
                                                    cursor: actionLoading ? 'not-allowed' : 'pointer',
                                                    flexShrink: 0
                                                }}
                                            />
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                {/* Left side: Song info */}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        {(() => {
                                                            const isDuett = song.title.includes('[DUET]');
                                                            const cleanTitle = isDuett ? song.title.replace(/\s*\[DUET\]\s*/gi, '').trim() : song.title;
                                                            const displayTitle = song.artist ? `${song.artist} - ${cleanTitle}` : cleanTitle;
                                                            
                                                            return (
                                                                <>
                                                                    <div
                                                                        style={{
                                                                            fontWeight: '600',
                                                                            fontSize: '16px',
                                                                            color: '#333',
                                                                            cursor: 'pointer',
                                                                            userSelect: 'none'
                                                                        }}
                                                                        onClick={() => handleToggleSongVisibility(song)}
                                                                        title={t('songList.toggleVisibility')}
                                                                    >
                                                                        {displayTitle}
                                                                    </div>
                                                                    <SmallModeBadge mode={song.mode} modes={song.modes} />
                                                                    {isDuett && <SmallModeBadge mode="duett" />}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* Status badges and processing button */}
                                                {(() => {
                                                    // Check if song is currently being processed
                                                    const isProcessing = processingSongs.has(`${song.artist}-${song.title}`);
                                                    
                                                    // Check if song has a processing status (from WebSocket or API)
                                                    const wsStatus = songStatuses.get(`${song.artist}-${song.title}`);
                                                    const apiStatus = song.download_status || song.status;
                                                    const processingStatus = wsStatus || apiStatus;
                                                    const hasActiveStatus = processingStatus && !['finished', 'ready', 'failed'].includes(processingStatus);
                                                    
                                                    // Show DownloadStatusBadge if processing or has active status
                                                    if (isProcessing || hasActiveStatus) {
                                                        // Only show badge if we have a valid status
                                                        if (processingStatus) {
                                                            return (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <DownloadStatusBadge status={processingStatus as DownloadStatus} />
                                                                </div>
                                                            );
                                                        }
                                                        // If processing but no status, show processing indicator
                                                        if (isProcessing) {
                                                            return (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{
                                                                        padding: '4px 8px',
                                                                        borderRadius: '6px',
                                                                        fontSize: '0.8rem',
                                                                        fontWeight: '500',
                                                                        backgroundColor: '#ffc107',
                                                                        color: 'white',
                                                                        minWidth: '80px',
                                                                        textAlign: 'center'
                                                                    }}>
                                                                        ⏳ {t('songList.processingRunning')}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    }
                                                    
                                                    // Show DownloadStatusBadge for failed status (but continue to show buttons)
                                                    let showFailedBadge = false;
                                                    if (processingStatus === 'failed') {
                                                        showFailedBadge = true;
                                                    }
                                                    
                                                    // Show processing buttons
                                                    const buttonState = getProcessingButtonState(song);
                                                    
                                                    // Show processing button only if:
                                                    // 1. Button is enabled AND
                                                    // 2. Status is 'failed' (retry) OR no status at all (first time)
                                                    const shouldShowProcessingButton = buttonState.enabled && 
                                                        (processingStatus === 'failed' || !processingStatus);
                                                    
                                                    // Show recreate button for Magic songs (always visible if not processing)
                                                    const shouldShowRecreateButton = (song.modes?.includes('magic-songs') || song.modes?.includes('magic-videos') || song.modes?.includes('magic-youtube')) && 
                                                        !isProcessing && !hasActiveStatus;
                                                    
                                                    // Show failed badge and/or buttons
                                                    if (!showFailedBadge && !shouldShowProcessingButton && !shouldShowRecreateButton) return null;
                                                    
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {/* Failed status badge */}
                                                            {showFailedBadge && (
                                                                <DownloadStatusBadge status="failed" />
                                                            )}
                                                            
                                                            {/* Recreate button for Magic songs only */}
                                                            {shouldShowRecreateButton && (
                                                                <Button
                                                                    onClick={() => handleRecreateSong(song)}
                                                                    disabled={actionLoading}
                                                                    size="large"
                                                                    style={{
                                                                        fontSize: '14px',
                                                                        padding: '8px 16px',
                                                                        backgroundColor: '#9b59b6',
                                                                        color: 'white',
                                                                        opacity: actionLoading ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    🔄 {t('songList.recreate')}
                                                                </Button>
                                                            )}
                                                            
                                                            {/* Processing button */}
                                                            {shouldShowProcessingButton && (
                                                                <Button
                                                                    onClick={() => handleStartProcessing(song)}
                                                                    disabled={actionLoading}
                                                                    variant="danger"
                                                                    size="large"
                                                                    style={{
                                                                        fontSize: '14px',
                                                                        padding: '8px 16px',
                                                                        backgroundColor: '#dc3545',
                                                                        borderColor: '#dc3545'
                                                                    }}
                                                                >
                                                                    🔧 {t('songList.startProcessing')}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Right side: Audio settings for Ultrastar and Magic songs */}
                                                {(song.modes?.includes('ultrastar') || song.modes?.includes('magic-songs') || song.modes?.includes('magic-videos') || song.modes?.includes('magic-youtube')) && (
                                                    <div style={{ padding: '8px', background: '#f8f9fa', borderRadius: '8px' }}>
                                                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#495057' }}>
                                                            {t('songList.audioPreference')}:
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`audio-${song.artist}-${song.title}`}
                                                                    value="hp2"
                                                                    checked={ultrastarAudioSettings[`${song.artist}-${song.title}`] === 'hp2'}
                                                                    onChange={(e) => handleUltrastarAudioChange(song, e.target.value)}
                                                                    disabled={actionLoading}
                                                                />
                                                                {t('songList.background')}
                                                            </label>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`audio-${song.artist}-${song.title}`}
                                                                    value="hp5"
                                                                    checked={ultrastarAudioSettings[`${song.artist}-${song.title}`] === 'hp5'}
                                                                    onChange={(e) => handleUltrastarAudioChange(song, e.target.value)}
                                                                    disabled={actionLoading}
                                                                />
                                                                {t('songList.instrumental')}
                                                            </label>
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                                                                <input
                                                                    type="radio"
                                                                    name={`audio-${song.artist}-${song.title}`}
                                                                    value="choice"
                                                                    checked={!ultrastarAudioSettings[`${song.artist}-${song.title}`] || ultrastarAudioSettings[`${song.artist}-${song.title}`] === 'choice'}
                                                                    onChange={(e) => handleUltrastarAudioChange(song, e.target.value)}
                                                                    disabled={actionLoading}
                                                                />
                                                                {t('songList.choice')}
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Test button for all songs - always on the right */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {/* Check if buttons should be disabled due to processing status */}
                                                    {(() => {
                                                        
                                                        return (
                                                            <>
                                                                {/* Rename button for all song types */}
                                                                <Button
                                                                    onClick={() => handleRenameSong(song)}
                                                                    disabled={shouldDisableButtons}
                                                                    size="small"
                                                                    style={{
                                                                        fontSize: '12px',
                                                                        padding: '6px 12px',
                                                                        backgroundColor: '#ffc107',
                                                                        color: '#212529',
                                                                        opacity: shouldDisableButtons ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    ✏️ {t('songList.rename')}
                                                                </Button>

                                                                {/* Delete button for all song types */}
                                                                <Button
                                                                    onClick={() => handleDeleteSongFromLibrary(song)}
                                                                    disabled={shouldDisableButtons}
                                                                    type="danger"
                                                                    size="small"
                                                                    style={{
                                                                        fontSize: '12px',
                                                                        padding: '6px 12px',
                                                                        opacity: shouldDisableButtons ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    🗑️ {t('songList.delete')}
                                                                </Button>

                                                                <Button
                                                                    onClick={() => handleTestSong(song)}
                                                                    disabled={shouldDisableTestButton}
                                                                    size="small"
                                                                    style={{
                                                                        fontSize: '12px',
                                                                        padding: '6px 12px',
                                                                        backgroundColor: '#17a2b8',
                                                                        opacity: shouldDisableTestButton ? 0.5 : 1
                                                                    }}
                                                                >
                                                                    🎤 {t('songList.test')}
                                                                </Button>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                );
            })()}
            <SettingsDescription>
                {t('songList.invisibleDescription')}
            </SettingsDescription>
        </SettingsCard>
        {/* modals */}
        <DeleteModal
            show={showDeleteModal}
            deleteSong={deleteSong}
            actionLoading={actionLoading}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
        />
        <RenameModal
            show={showRenameModal}
            renameSong={renameSong}
            actionLoading={actionLoading}
            onClose={handleRenameCancel}
            onConfirm={handleRenameConfirm}
        />
        <YoutubeDownloadModal
            show={showYouTubeDialog}
            selectedSongForDownload={selectedSongForDownload}
            onClose={handleCloseYouTubeDialog}
            onContinueWithoutVideo={handleProcessWithoutVideo}
            startNormalProcessing={startNormalProcessing}
        />
    </>
};

export default SongList;
