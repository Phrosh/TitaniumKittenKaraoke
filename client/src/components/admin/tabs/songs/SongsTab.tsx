import React from 'react';
import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { adminAPI, songAPI } from '../../../../services/api';
import toast from 'react-hot-toast';
import {
    SettingsSection,
    SettingsTitle,
    SettingsCard,
    SettingsLabel,
    SettingsInput,
    SettingsDescription
} from '../../../shared/style';
import ModeBadge from '../../../shared/ModeBadge';
import SongList from './SongList';
import UsdbDownloadModal from './UsdbDownloadModal';
import Button from '../../../shared/Button';

interface SongsTabProps {
    fetchDashboardData: () => void;
}

const SongsTab: React.FC<SongsTabProps> = ({
    fetchDashboardData,
}) => {
    const { t } = useTranslation();
    
    const [songSearchTerm, setSongSearchTerm] = useState('');
    const [songTab, setSongTab] = useState<'all' | 'visible' | 'invisible'>('all');
    const [showUsdbDialog, setShowUsdbDialog] = useState(false);
    const [songs, setSongs] = useState<any[]>([]);
    const [invisibleSongs, setInvisibleSongs] = useState<any[]>([]);

    const [ultrastarAudioSettings, setUltrastarAudioSettings] = useState<Record<string, string>>({});

    const handleOpenUsdbDialog = () => {
        const usdbCredentials = fetchUSDBCredentials();
        if (!usdbCredentials) {
            toast.error(t('songs.usdbCredentialsRequired'));
            return;
        }
        setShowUsdbDialog(true);
    };

    const fetchSongs = useCallback(async () => {
        try {
            const [localResponse, ultrastarResponse, fileResponse, audioSettingsResponse, youtubeResponse, magicSongsResponse, magicVideosResponse, magicYouTubeResponse] = await Promise.all([
                songAPI.getServerVideos(),
                songAPI.getUltrastarSongs(),
                songAPI.getFileSongs(),
                adminAPI.getUltrastarAudioSettings(),
                songAPI.getYouTubeSongs(),
                songAPI.getMagicSongs(),
                songAPI.getMagicVideos(),
                songAPI.getMagicYouTube()
            ]);

            const serverVideos = localResponse.data.videos || [];
            const ultrastarSongs = ultrastarResponse.data.songs || [];
            const fileSongs = fileResponse.data.fileSongs || [];
            const youtubeSongs = youtubeResponse.data.youtubeSongs || [];
            const magicSongs = magicSongsResponse.data.songs || [];
            const magicVideos = magicVideosResponse.data.videos || [];
            const magicYouTube = magicYouTubeResponse.data.videos || [];
            const audioSettings = audioSettingsResponse.data.ultrastarAudioSettings || [];

            // Convert audio settings to a lookup object
            const audioSettingsMap: Record<string, string> = {};
            audioSettings.forEach((setting: any) => {
                const key = `${setting.artist}-${setting.title}`;
                audioSettingsMap[key] = setting.audio_preference;
            });
            setUltrastarAudioSettings(audioSettingsMap);

            // Combine and deduplicate songs, preserving all modes
            const allSongs = [...fileSongs];

            // Add server videos
            serverVideos.forEach(serverVideo => {
                const existingIndex = allSongs.findIndex(song =>
                    song.artist.toLowerCase() === serverVideo.artist.toLowerCase() &&
                    song.title.toLowerCase() === serverVideo.title.toLowerCase()
                );
                if (existingIndex !== -1) {
                    // Song exists, add server_video mode
                    if (!allSongs[existingIndex].modes) {
                        allSongs[existingIndex].modes = [];
                    }
                    if (!allSongs[existingIndex].modes.includes('server_video')) {
                        allSongs[existingIndex].modes.push('server_video');
                    }
                } else {
                    // Song doesn't exist, add as server_video only
                    allSongs.push({ ...serverVideo, modes: ['server_video'] });
                }
            });

            // Add ultrastar songs
            ultrastarSongs.forEach(ultrastarSong => {
                const existingIndex = allSongs.findIndex(song =>
                    song.artist.toLowerCase() === ultrastarSong.artist.toLowerCase() &&
                    song.title.toLowerCase() === ultrastarSong.title.toLowerCase()
                );
                if (existingIndex !== -1) {
                    // Song exists, add ultrastar mode and file status
                    if (!allSongs[existingIndex].modes) {
                        allSongs[existingIndex].modes = [];
                    }
                    if (!allSongs[existingIndex].modes.includes('ultrastar')) {
                        allSongs[existingIndex].modes.push('ultrastar');
                    }
                    // Update file status from ultrastar song
                    allSongs[existingIndex].hasVideo = ultrastarSong.hasVideo;
                    allSongs[existingIndex].hasPreferredVideo = ultrastarSong.hasPreferredVideo;
                    allSongs[existingIndex].hasHp2Hp5 = ultrastarSong.hasHp2Hp5;
                    allSongs[existingIndex].hasAudio = ultrastarSong.hasAudio;
                } else {
                    // Song doesn't exist, add as ultrastar only with file status
                    allSongs.push({
                        ...ultrastarSong,
                        modes: ['ultrastar'],
                        hasVideo: ultrastarSong.hasVideo,
                        hasPreferredVideo: ultrastarSong.hasPreferredVideo,
                        hasHp2Hp5: ultrastarSong.hasHp2Hp5,
                        hasAudio: ultrastarSong.hasAudio
                    });
                }
            });

            // Add YouTube cache songs
            youtubeSongs.forEach(youtubeSong => {
                const existingIndex = allSongs.findIndex(song =>
                    song.artist.toLowerCase() === youtubeSong.artist.toLowerCase() &&
                    song.title.toLowerCase() === youtubeSong.title.toLowerCase()
                );
                if (existingIndex !== -1) {
                    // Song exists, add youtube_cache mode
                    if (!allSongs[existingIndex].modes) {
                        allSongs[existingIndex].modes = [];
                    }
                    if (!allSongs[existingIndex].modes.includes('youtube_cache')) {
                        allSongs[existingIndex].modes.push('youtube_cache');
                    }
                } else {
                    // Song doesn't exist, add as youtube_cache only
                    allSongs.push({
                        ...youtubeSong,
                        modes: ['youtube_cache'],
                        hasVideo: youtubeSong.hasVideo
                    });
                }
            });

            // Add Magic Songs
            magicSongs.forEach(magicSong => {
                const existingIndex = allSongs.findIndex(song =>
                    song.artist.toLowerCase() === magicSong.artist.toLowerCase() &&
                    song.title.toLowerCase() === magicSong.title.toLowerCase()
                );
                if (existingIndex !== -1) {
                    // Song exists, add magic-songs mode
                    if (!allSongs[existingIndex].modes) {
                        allSongs[existingIndex].modes = [];
                    }
                    if (!allSongs[existingIndex].modes.includes('magic-songs')) {
                        allSongs[existingIndex].modes.push('magic-songs');
                    }
                    // Update file status from magic song
                    allSongs[existingIndex].hasUltrastar = magicSong.hasUltrastar;
                    allSongs[existingIndex].hasCover = magicSong.hasCover;
                } else {
                    // Song doesn't exist, add as magic-songs only
                    allSongs.push({
                        ...magicSong,
                        modes: ['magic-songs'],
                        hasUltrastar: magicSong.hasUltrastar,
                        hasCover: magicSong.hasCover
                    });
                }
            });

            // Add Magic Videos
            magicVideos.forEach(magicVideo => {
                const existingIndex = allSongs.findIndex(song =>
                    song.artist.toLowerCase() === magicVideo.artist.toLowerCase() &&
                    song.title.toLowerCase() === magicVideo.title.toLowerCase()
                );
                if (existingIndex !== -1) {
                    // Song exists, add magic-videos mode
                    if (!allSongs[existingIndex].modes) {
                        allSongs[existingIndex].modes = [];
                    }
                    if (!allSongs[existingIndex].modes.includes('magic-videos')) {
                        allSongs[existingIndex].modes.push('magic-videos');
                    }
                    // Update file status from magic video
                    allSongs[existingIndex].hasUltrastar = magicVideo.hasUltrastar;
                    allSongs[existingIndex].hasRemuxed = magicVideo.hasRemuxed;
                } else {
                    // Song doesn't exist, add as magic-videos only
                    allSongs.push({
                        ...magicVideo,
                        modes: ['magic-videos'],
                        hasUltrastar: magicVideo.hasUltrastar,
                        hasRemuxed: magicVideo.hasRemuxed
                    });
                }
            });

            // Add Magic YouTube
            magicYouTube.forEach(magicYouTubeVideo => {
                const existingIndex = allSongs.findIndex(song =>
                    song.artist.toLowerCase() === magicYouTubeVideo.artist.toLowerCase() &&
                    song.title.toLowerCase() === magicYouTubeVideo.title.toLowerCase()
                );
                if (existingIndex !== -1) {
                    // Song exists, add magic-youtube mode
                    if (!allSongs[existingIndex].modes) {
                        allSongs[existingIndex].modes = [];
                    }
                    if (!allSongs[existingIndex].modes.includes('magic-youtube')) {
                        allSongs[existingIndex].modes.push('magic-youtube');
                    }
                    // Update file status from magic YouTube video
                    allSongs[existingIndex].hasUltrastar = magicYouTubeVideo.hasUltrastar;
                    allSongs[existingIndex].hasRemuxed = magicYouTubeVideo.hasRemuxed;
                } else {
                    // Song doesn't exist, add as magic-youtube only
                    allSongs.push({
                        ...magicYouTubeVideo,
                        modes: ['magic-youtube'],
                        hasUltrastar: magicYouTubeVideo.hasUltrastar,
                        hasRemuxed: magicYouTubeVideo.hasRemuxed
                    });
                }
            });

            // Add modes array to songs that don't have modes yet
            allSongs.forEach(song => {
                if (!song.modes) {
                    song.modes = ['file'];
                }
            });

            // Sort alphabetically by artist, then by title
            allSongs.sort((a, b) => {
                const artistA = a.artist.toLowerCase();
                const artistB = b.artist.toLowerCase();
                if (artistA !== artistB) {
                    return artistA.localeCompare(artistB);
                }
                return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
            });

            setSongs(allSongs);
        } catch (error) {
            console.error('Error loading songs:', error);
            toast.error(t('songs.loadError'));
        }
    }, []);

    const fetchUSDBCredentials = async () => {
        try {
            const response = await adminAPI.getUSDBCredentials();
            return response.data.credentials;
        } catch (error) {
            console.error('Error fetching USDB credentials:', error);
            return null;
        }
    };

    const handleCloseUsdbDialog = async () => {
        setShowUsdbDialog(false);

        // Rescan song list after closing USDB dialog
        try {
            // First rescan file system songs (includes USDB downloads)
            await adminAPI.rescanFileSongs();

            // Then fetch all songs to update the UI
            await fetchSongs();

            toast.success(t('songs.songListUpdated'));
        } catch (error) {
            console.error('Error refreshing song list:', error);
            // Don't show error toast as this is a background operation
        }
    };

    return <>
        <SettingsSection>
            <SettingsTitle>🎵 {t('songs.title')}</SettingsTitle>

            {/* Two-column layout */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                {/* Left column: Song management buttons and search */}
                <div style={{ flex: '1', minWidth: '0' }}>
                    {/* Song Tabs */}
                    <SettingsCard>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <Button
                                onClick={() => setSongTab('all')}
                                variant={songTab === 'all' ? 'primary' : 'default'}
                                size="small"
                                style={{
                                    borderColor: songTab === 'all' ? '#667eea' : '#e1e5e9',
                                    backgroundColor: songTab === 'all' ? '#667eea' : 'white',
                                    color: songTab === 'all' ? 'white' : '#333'
                                }}
                            >
                                {t('songs.allSongs', { count: songs.length })}
                            </Button>
                            <Button
                                onClick={() => setSongTab('visible')}
                                variant={songTab === 'visible' ? 'success' : 'default'}
                                size="small"
                                style={{
                                    borderColor: songTab === 'visible' ? '#28a745' : '#e1e5e9',
                                    backgroundColor: songTab === 'visible' ? '#28a745' : 'white',
                                    color: songTab === 'visible' ? 'white' : '#333'
                                }}
                            >
                                {t('songs.visibleSongs', { count: songs.filter(song => !invisibleSongs.some(invisible =>
                                    invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                                    invisible.title.toLowerCase() === song.title.toLowerCase()
                                )).length })}
                            </Button>
                            <Button
                                onClick={() => setSongTab('invisible')}
                                variant={songTab === 'invisible' ? 'danger' : 'default'}
                                size="small"
                                style={{
                                    borderColor: songTab === 'invisible' ? '#dc3545' : '#e1e5e9',
                                    backgroundColor: songTab === 'invisible' ? '#dc3545' : 'white',
                                    color: songTab === 'invisible' ? 'white' : '#333'
                                }}
                            >
                                {t('songs.invisibleSongs', { count: songs.filter(song => invisibleSongs.some(invisible =>
                                    invisible.artist.toLowerCase() === song.artist.toLowerCase() &&
                                    invisible.title.toLowerCase() === song.title.toLowerCase()
                                )).length })}
                            </Button>
                        </div>

                        {/* Search songs */}
                        <SettingsLabel>{t('songs.searchSongs')}</SettingsLabel>
                        <SettingsInput
                            type="text"
                            placeholder={t('songs.searchPlaceholder')}
                            value={songSearchTerm}
                            onChange={(e) => setSongSearchTerm(e.target.value)}
                            style={{ marginBottom: '15px', width: '100%', maxWidth: '600px' }}
                        />
                        <SettingsDescription>
                            {t('songs.managementDescription')}
                        </SettingsDescription>
                    </SettingsCard>
                </div>

                {/* Right column: USDB Download */}
                <div style={{ flex: '0 0 350px', minWidth: '350px' }}>
                    <SettingsCard>
                        <SettingsLabel>{t('songs.usdbDownload')}</SettingsLabel>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                            <Button
                                type="button"
                                onClick={handleOpenUsdbDialog}
                                size="small"
                                style={{
                                    backgroundColor: '#6f42c1',
                                    width: '100%',
                                    justifyContent: 'center'
                                }}
                            >
                                🌐 {t('songs.usdbLoadSong')}
                            </Button>
                        </div>
                        <SettingsDescription>
                            {t('songs.usdbDescription')} (
                            <a
                                href="https://usdb.animux.de"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#007bff', textDecoration: 'underline' }}
                            >
                                usdb.animux.de
                            </a>
                            ) {t('songs.usdbDescriptionEnd')}.
                        </SettingsDescription>
                    </SettingsCard>
                </div>
            </div>

            <SongList
                ultrastarAudioSettings={ultrastarAudioSettings}
                setUltrastarAudioSettings={setUltrastarAudioSettings}
                songTab={songTab}
                songSearchTerm={songSearchTerm}
                fetchDashboardData={fetchDashboardData}
                songs={songs}
                invisibleSongs={invisibleSongs}
                setInvisibleSongs={setInvisibleSongs}
                fetchSongs={fetchSongs}
            />
        </SettingsSection>
        {/* Modals */}
        <UsdbDownloadModal
            show={showUsdbDialog}
            fetchSongs={fetchSongs}
            handleCloseUsdbDialog={handleCloseUsdbDialog}
        />
    </>
};

export default SongsTab;
