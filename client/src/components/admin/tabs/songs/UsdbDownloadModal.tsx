import React, { useEffect } from 'react';
import styled from 'styled-components';
import {adminAPI} from '../../../../services/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../../../shared/Button';

interface Progress {
  current: number;
  total: number;
}

interface USDBDownloadModalProps {
  show: boolean;
  fetchSongs: () => void;
  handleCloseUsdbDialog: () => void;
}


const USDBDownloadModal: React.FC<USDBDownloadModalProps> = ({
  show,
  fetchSongs,
  handleCloseUsdbDialog
}) => {
  const { t } = useTranslation();
  const [usdbBatchDownloading, setUsdbBatchDownloading] = useState(false);
  const [usdbBatchProgress, setUsdbBatchProgress] = useState({ current: 0, total: 0 });
  const [usdbBatchUrls, setUsdbBatchUrls] = useState<string[]>(['']);
  const [usdbBatchCurrentDownloading, setUsdbBatchCurrentDownloading] = useState<number | null>(null);
  const [usdbBatchResults, setUsdbBatchResults] = useState<Array<{url: string, status: 'pending' | 'downloading' | 'completed' | 'error', message?: string}>>([]);
  const [oldDownloadUrls, setOldDownloadUrls] = useState([]);

  // USDB Search Management
  const [usdbSearchInterpret, setUsdbSearchInterpret] = useState('');
  const [usdbSearchTitle, setUsdbSearchTitle] = useState('');
  const [usdbSearchLoading, setUsdbSearchLoading] = useState(false);
  const [usdbSearchResults, setUsdbSearchResults] = useState<Array<{id: number, artist: string, title: string, url: string}>>([]);

  useEffect(() => {
    if (oldDownloadUrls.length > 0) {
      const urls = usdbBatchUrls.filter((url: string) => !oldDownloadUrls.includes(url));
      setUsdbBatchUrls(urls);
      setOldDownloadUrls([]);
      setUsdbBatchCurrentDownloading(null);
      handleBatchDownloadFromUSDB(null, urls);
    }
  }, [oldDownloadUrls]);

  const handleRemoveBatchUrlField = (index: number) => {
    if (usdbBatchUrls.length > 1) {
      const removedUrl = usdbBatchUrls[index];
      const newUrls = usdbBatchUrls.filter((_, i) => i !== index);
      setUsdbBatchUrls(newUrls);
      
      // Update results array accordingly
      const newResults = usdbBatchResults.filter((_, i) => i !== index);
      setUsdbBatchResults(newResults);

      // If the removed URL was from search results, show a message
      if (removedUrl && removedUrl.includes('usdb.animux.de')) {
        toast(t('usdbDownloadModal.songRemovedFromList'));
      }
    }
  };

  const handleBatchUrlChange = (index: number, value: string) => {
    const newUrls = [...usdbBatchUrls];
    newUrls[index] = value;
    setUsdbBatchUrls(newUrls);
    
    // Auto-add new field if current field has content and it's the last field
    if (value.trim() && index === usdbBatchUrls.length - 1) {
      setUsdbBatchUrls([...newUrls, '']);
    }
  };

  const handleBatchDownloadFromUSDB = async (event?: React.MouseEvent, urls?: string[]) => {
    // Filter out empty URLs
    const validUrls = (urls || usdbBatchUrls).filter(url => url.trim());
    
    if (validUrls.length === 0) {
      // toast.error('Bitte mindestens eine USDB-URL eingeben');
      return;
    }

    setUsdbBatchDownloading(true);
    setUsdbBatchProgress({ current: 0, total: validUrls.length });
    
    // Initialize results
    const initialResults = validUrls.map(url => ({
      url,
      status: 'pending' as const,
      message: ''
    }));
    setUsdbBatchResults(initialResults);

    try {
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        
        // Find the index in the original array
        const originalIndex = usdbBatchUrls.findIndex(u => u === url);
        setUsdbBatchCurrentDownloading(originalIndex);
        
        // Update current status to downloading
        setUsdbBatchResults(prev => prev.map((result, index) => 
          index === i ? { ...result, status: 'downloading' } : result
        ));
        
        try {
          const response = await adminAPI.downloadFromUSDB(url);
          
          // Mark as completed
          setUsdbBatchResults(prev => prev.map((result, index) => 
            index === i ? { 
              ...result, 
              status: 'completed', 
              message: response.data.message || t('usdbDownloadModal.downloadSuccessful')
            } : result
          ));
          
          // Update progress
          setUsdbBatchProgress({ current: i + 1, total: validUrls.length });
          
        } catch (error: any) {
          // Mark as error
          const errorMessage = error.response?.data?.message || t('usdbDownloadModal.downloadError');
          setUsdbBatchResults(prev => prev.map((result, index) => 
            index === i ? { 
              ...result, 
              status: 'error', 
              message: errorMessage
            } : result
          ));
          
          // Update progress even on error
          setUsdbBatchProgress({ current: i + 1, total: validUrls.length });
        }
      }
      
      // All downloads completed
      toast.success(t('usdbDownloadModal.batchDownloadCompleted', { count: validUrls.length }));
      
      // Rescan song list
      try {
        await adminAPI.rescanFileSongs();
        await fetchSongs();
      } catch (rescanError) {
        console.error('Error rescanning after batch download:', rescanError);
      }
      
      setOldDownloadUrls(validUrls);
      setUsdbBatchProgress({ current: 0, total: 0 });
      setUsdbBatchResults([]);
      // setUsdbDownloadFinished(true);
    } catch (error) {
      console.error('Error in batch download:', error);
      toast.error(t('usdbDownloadModal.batchDownloadError'));
    } finally {
      setUsdbBatchDownloading(false);
      setUsdbBatchCurrentDownloading(null);
    }
  };

  const handleSearchUSDB = async () => {
    if (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim()) {
      toast.error(t('usdbDownloadModal.enterArtistOrTitle'));
      return;
    }

    setUsdbSearchLoading(true);
    try {
      const response = await adminAPI.searchUSDB(
        usdbSearchInterpret.trim() || undefined,
        usdbSearchTitle.trim() || undefined,
        100 // Limit to 100 results
      );

      const songs = response.data.songs || [];
      setUsdbSearchResults(songs);
      
      if (songs.length === 0) {
        toast(t('usdbDownloadModal.noSongsFound'));
      } else {
        toast.success(t('usdbDownloadModal.songsFound', { count: songs.length }));
      }
    } catch (error: any) {
      console.error('Error searching USDB:', error);
      const message = error.response?.data?.message || t('usdbDownloadModal.searchError');
      toast.error(message);
    } finally {
      setUsdbSearchLoading(false);
    }
  };

  const handleAddSearchResultToDownload = (song: {id: number, artist: string, title: string, url: string}) => {
    // Check if URL already exists in batch list
    const urlExists = usdbBatchUrls.some(url => url.trim() === song.url);
    
    if (urlExists) {
      toast(t('usdbDownloadModal.songAlreadyInList'));
      return;
    }

    // Add to batch URLs
    const newUrls = [...usdbBatchUrls];
    if (newUrls[newUrls.length - 1] === '') {
      // Replace empty last field
      newUrls[newUrls.length - 1] = song.url;
    } else {
      // Add new field
      newUrls.push(song.url);
    }
    
    // Always add an empty field at the end for new entries
    newUrls.push('');
    setUsdbBatchUrls(newUrls);

    // Remove from search results
    setUsdbSearchResults(prev => prev.filter(s => s.id !== song.id));
    
    toast.success(t('usdbDownloadModal.songAddedToList', { artist: song.artist, title: song.title }));
  };

  // Filter search results to remove songs already in download list
  React.useEffect(() => {
    if (usdbSearchResults.length > 0) {
      const filteredResults = usdbSearchResults.filter(song => 
        !usdbBatchUrls.some(url => url.trim() === song.url)
      );
      if (filteredResults.length !== usdbSearchResults.length) {
        setUsdbSearchResults(filteredResults);
      }
    }
  }, [usdbBatchUrls]);

  useEffect(() => {
    if (!show) {

      // setUsdbUrl('');
        
      // Reset batch states
      setUsdbBatchUrls(['']);
      setUsdbBatchDownloading(false);
      setUsdbBatchProgress({ current: 0, total: 0 });
      setUsdbBatchResults([]);
      setUsdbBatchCurrentDownloading(null);
      
      // Reset search state
      setUsdbSearchInterpret('');
      setUsdbSearchTitle('');
      setUsdbSearchResults([]);
      setUsdbSearchLoading(false);
    }
  }, [show]);



    if (!show) return null;

    return (
<div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '1200px',
            width: '95%',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{
              margin: '0 0 20px 0',
              color: '#333',
              fontSize: '20px',
              fontWeight: '600'
            }}>
              🌐 {t('usdbDownloadModal.title')}
            </h3>
            
            {/* Two-column layout */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '30px',
              minHeight: '500px'
            }}>
              {/* Left column: Batch Download */}
              <div style={{
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f8f9fa'
              }}>
                <h4 style={{
                  margin: '0 0 15px 0',
                  color: '#333',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  📥 {t('usdbDownloadModal.batchDownload')}
                </h4>
            
                {/* Progress Bar */}
                {usdbBatchDownloading && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                        {t('usdbDownloadModal.progress')}:
                      </span>
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        {usdbBatchProgress.current} / {usdbBatchProgress.total} {t('usdbDownloadModal.downloads')}
                      </span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: '#e1e5e9',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(usdbBatchProgress.current / usdbBatchProgress.total) * 100}%`,
                        height: '100%',
                        backgroundColor: '#6f42c1',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )}
            
                {/* Batch URL Fields */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#333' }}>
                    {t('usdbDownloadModal.usdbUrls')}:
                  </label>
                  
                  {usdbBatchUrls.map((url, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px', 
                      marginBottom: '10px' 
                    }}>
                      {/* X Button */}
                      {usdbBatchUrls.length > 1 && (
                        <Button
                          onClick={() => handleRemoveBatchUrlField(index)}
                          disabled={usdbBatchCurrentDownloading === index}
                          type="danger"
                          size="small"
                          style={{
                            width: '32px',
                            height: '32px',
                            padding: '0',
                            minWidth: 'auto',
                            flexShrink: 0
                          }}
                        >
                          ×
                        </Button>
                      )}
                      
                      {/* URL Input */}
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => handleBatchUrlChange(index, e.target.value)}
                          placeholder=""
                          disabled={usdbBatchCurrentDownloading === index}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: '2px solid #e1e5e9',
                            borderRadius: '8px',
                            fontSize: '14px',
                            transition: 'border-color 0.2s ease',
                            backgroundColor: usdbBatchDownloading ? '#f8f9fa' : 'white',
                            color: usdbBatchDownloading ? '#666' : '#333'
                          }}
                          onFocus={(e) => {
                            if (!usdbBatchDownloading) {
                              e.target.style.borderColor = '#667eea';
                            }
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = '#e1e5e9';
                          }}
                        />
                        
                        {/* Status Indicator */}
                        {usdbBatchResults[index] && (
                          <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '18px'
                          }}>
                            {usdbBatchResults[index].status === 'pending' && '⏳'}
                            {usdbBatchResults[index].status === 'downloading' && '🔄'}
                            {usdbBatchResults[index].status === 'completed' && '✅'}
                            {usdbBatchResults[index].status === 'error' && '❌'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            
                
                {/* Batch Download Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}>
                  <Button
                    onClick={handleBatchDownloadFromUSDB}
                    disabled={usdbBatchDownloading || usdbBatchUrls.filter(url => url.trim()).length === 0}
                    size="small"
                    style={{ backgroundColor: '#6f42c1' }}
                  >
                    {usdbBatchDownloading ? `⏳ ${t('usdbDownloadModal.downloadsRunning')}` : `🌐 ${t('usdbDownloadModal.startBatchDownload')}`}
                  </Button>
                </div>
              </div>

              {/* Right column: Search */}
              <div style={{
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f8f9fa'
              }}>
                <h4 style={{
                  margin: '0 0 15px 0',
                  color: '#333',
                  fontSize: '16px',
                  fontWeight: '600'
                }}>
                  🔍 {t('usdbDownloadModal.songSearch')}
                </h4>

                {/* Search Form */}
                <div style={{ marginBottom: '20px' }}>
                  {/* Interpret and Title side by side */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '12px', 
                    marginBottom: '12px' 
                  }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        {t('usdbDownloadModal.artist')}:
                      </label>
                      <input
                        type="text"
                        value={usdbSearchInterpret}
                        onChange={(e) => setUsdbSearchInterpret(e.target.value)}
                        placeholder={t('usdbDownloadModal.artistPlaceholder')}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchUSDB();
                          }
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333', fontSize: '14px' }}>
                        {t('usdbDownloadModal.titleOptional')}:
                      </label>
                      <input
                        type="text"
                        value={usdbSearchTitle}
                        onChange={(e) => setUsdbSearchTitle(e.target.value)}
                        placeholder={t('usdbDownloadModal.titlePlaceholder')}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#667eea'}
                        onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchUSDB();
                          }
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSearchUSDB}
                    disabled={usdbSearchLoading || (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim())}
                    variant="success"
                    size="small"
                    style={{ width: '100%' }}
                  >
                    {usdbSearchLoading ? `⏳ ${t('usdbDownloadModal.searching')}` : `🔍 ${t('usdbDownloadModal.search')}`}
                  </Button>
                </div>

                {/* Search Results */}
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {usdbSearchResults.length > 0 ? (
                    <div>
                      <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                        {t('usdbDownloadModal.foundSongs', { count: usdbSearchResults.length })}:
                      </div>
                      {usdbSearchResults.map((song) => (
                        <div
                          key={song.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px',
                            marginBottom: '8px',
                            backgroundColor: 'white',
                            border: '1px solid #e1e5e9',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                            e.currentTarget.style.borderColor = '#667eea';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                            e.currentTarget.style.borderColor = '#e1e5e9';
                          }}
                          onClick={() => handleAddSearchResultToDownload(song)}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>
                              {song.artist}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              {song.title}
                            </div>
                          </div>
                          <div style={{ fontSize: '18px', color: '#28a745' }}>
                            ➕
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ 
                      textAlign: 'center', 
                      color: '#666', 
                      fontSize: '14px',
                      padding: '20px'
                    }}>
                      {usdbSearchLoading ? t('usdbDownloadModal.searching') : t('usdbDownloadModal.noSearchResults')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid #e1e5e9'
            }}>
              <Button
                onClick={handleCloseUsdbDialog}
                disabled={usdbBatchDownloading}
                type="default"
                size="small"
              >
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
    );

};

export default USDBDownloadModal;