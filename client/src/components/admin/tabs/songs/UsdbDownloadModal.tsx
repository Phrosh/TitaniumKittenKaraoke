import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import {adminAPI} from '../../../../services/api';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Button from '../../../shared/Button';
import websocketService from '../../../../services/websocket';
import { DownloadStatus } from '../../../../utils/helper';
import DownloadStatusBadge from '../../../shared/DownloadStatusBadge';

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
  const [usdbBatchResults, setUsdbBatchResults] = useState<Array<{url: string, status: 'pending' | 'downloading' | 'separating' | 'finished' | 'failed', message?: string, songId?: number, batchId?: string}>>([]);
  const [oldDownloadUrls, setOldDownloadUrls] = useState<string[]>([]);
  
  // Generate unique modal ID to prevent conflicts between multiple modal sessions
  const [modalSessionId] = useState(() => Math.floor(Math.random() * 10000).toString());
  
  // Ref to track download status for sequential processing
  const downloadStatusRef = useRef<Map<string, string>>(new Map());

  // Derived flag: a batch is active if any result is pending/downloading/separating
  const isBatchActive = usdbBatchResults.some(r => r.status === 'pending' || r.status === 'downloading' || r.status === 'separating');

  // USDB Search Management
  const [usdbSearchInterpret, setUsdbSearchInterpret] = useState('');
  const [usdbSearchTitle, setUsdbSearchTitle] = useState('');
  const [usdbSearchLoading, setUsdbSearchLoading] = useState(false);
  const [usdbSearchResults, setUsdbSearchResults] = useState<Array<{id: number, artist: string, title: string, url: string}>>([]);

  // WebSocket listener for processing status updates
  useEffect(() => {
    const handleProcessingStatus = (data: { id?: number | string; artist?: string; title?: string; status: DownloadStatus }) => {
      console.log('🛰️ UsdbDownloadModal: processing-status received via WS:', data);
      
      if (data.id && data.status) {
        // Check if this is a batch download ID (usdb-0, usdb-1, etc.)
        const batchId = typeof data.id === 'string' && data.id.startsWith('usdb-') ? data.id : null;
        
        if (batchId) {
          // Check if this batch ID belongs to our current modal session
          const expectedPrefix = `usdb-${modalSessionId}-`;
          if (batchId.startsWith(expectedPrefix)) {
            console.log('🛰️ UsdbDownloadModal: updating batch download status for', batchId, 'to', data.status);
            // Update the ref for sequential processing
            downloadStatusRef.current.set(batchId, data.status);
            
            setUsdbBatchResults(prev => {
              const updated = prev.map(result => {
                if (result.batchId === batchId) {
                  return {
                    ...result,
                    status: data.status as 'downloading' | 'separating' | 'finished' | 'failed',
                    message: data.status === 'finished' ? t('usdbDownloadModal.downloadSuccessful') : 
                             data.status === 'failed' ? t('usdbDownloadModal.downloadError') : 
                             result.message
                  };
                }
                return result;
              });

              // Check if all downloads are finished/failed and disable batch downloading
              const allFinished = updated.length > 0 && updated.every(r => r.status === 'finished' || r.status === 'failed');
              if (allFinished) {
                console.log('🎉 All downloads finished, disabling batch downloading');
                setUsdbBatchDownloading(false);
              }

              return updated;
            });
          } else {
            console.log('🛰️ UsdbDownloadModal: ignoring batch ID from different session:', batchId, '(expected prefix:', expectedPrefix, ')');
          }
        } else if (typeof data.id === 'number') {
          // Regular song ID - update by songId
          console.log('🛰️ UsdbDownloadModal: updating song status for', data.id, 'to', data.status);
          setUsdbBatchResults(prev => prev.map(result => {
            if (result.songId === data.id) {
              return {
                ...result,
                status: data.status as 'downloading' | 'separating' | 'finished' | 'failed',
                message: data.status === 'finished' ? t('usdbDownloadModal.downloadSuccessful') : 
                         data.status === 'failed' ? t('usdbDownloadModal.downloadError') : 
                         result.message
              };
            }
            return result;
          }));
        }
      }
    };

    websocketService.on('processing-status', handleProcessingStatus);

    return () => {
      websocketService.off('processing-status', handleProcessingStatus);
    };
  }, [t, modalSessionId]);

  useEffect(() => {
    if (oldDownloadUrls.length > 0) {
      const urls = usdbBatchUrls.filter((url: string) => !oldDownloadUrls.includes(url));
      setUsdbBatchUrls(urls);
      setOldDownloadUrls([]);
      setUsdbBatchCurrentDownloading(null);
      handleBatchDownloadFromUSDB(undefined, urls);
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
    
    // If downloads are currently running and a new URL was added, start downloading it
    if (usdbBatchDownloading && value.trim() && index === usdbBatchUrls.length - 1) {
      console.log('🚀 New URL added during download, starting additional download:', value);
      startAdditionalDownload(value, newUrls.length - 1);
    }
  };

  // Function to start an additional download during an ongoing batch
  const startAdditionalDownload = async (url: string, index: number) => {
    const batchId = `usdb-${modalSessionId}-${index}`;
    
    try {
      console.log('🚀 Starting additional USDB download for URL:', url, 'with batch ID:', batchId);
      setUsdbBatchDownloading(true);
      
      // Add the new download to batch results
      setUsdbBatchResults(prev => [...prev, {
        url,
        status: 'downloading' as const,
        message: t('usdbDownloadModal.downloadStarted'),
        songId: undefined,
        batchId: batchId
      }]);
      
      // Update progress
      setUsdbBatchProgress(prev => ({ ...prev, total: prev.total + 1 }));
      
      const response = await adminAPI.downloadFromUSDB(url, batchId);
      
      // Extract song ID from response if available
      const songId = response.data.song?.id;
      
      if (songId) {
        console.log('✅ Additional USDB download started successfully, song ID:', songId, 'batch ID:', batchId);
        // Update result with song ID
        setUsdbBatchResults(prev => prev.map(result => 
          result.batchId === batchId ? { 
            ...result, 
            songId: songId,
            message: t('usdbDownloadModal.downloadStarted')
          } : result
        ));
      } else {
        console.log('⚠️ Additional USDB download started but no song ID returned, batch ID:', batchId);
      }
      
    } catch (error: any) {
      console.error('❌ Error starting additional USDB download:', error);
      const errorMessage = error.response?.data?.message || t('usdbDownloadModal.downloadError');
      setUsdbBatchResults(prev => prev.map(result => 
        result.batchId === batchId ? { 
          ...result, 
          status: 'failed', 
          message: errorMessage
        } : result
      ));
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
    
    // Initialize results with batch IDs using modal session ID
    const initialResults = validUrls.map((url, index) => ({
      url,
      status: 'pending' as const,
      message: '',
      songId: undefined as number | undefined,
      batchId: `usdb-${modalSessionId}-${index}` as string
    }));
    setUsdbBatchResults(initialResults);

    try {
      // Start downloads sequentially, waiting for each to reach "separating" status
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];
        const batchId = `usdb-${modalSessionId}-${i}`;
        
        try {
          console.log('🚀 Starting USDB download for URL:', url, 'with batch ID:', batchId);
          const response = await adminAPI.downloadFromUSDB(url, batchId);
          
          // Extract song ID from response if available
          const songId = response.data.song?.id;
          
          if (songId) {
            console.log('✅ USDB download started successfully, song ID:', songId, 'batch ID:', batchId);
            // Update result with song ID and set to downloading
            setUsdbBatchResults(prev => prev.map((result, index) => 
              index === i ? { 
                ...result, 
                status: 'downloading',
                songId: songId,
                message: t('usdbDownloadModal.downloadStarted')
              } : result
            ));
          } else {
            console.log('⚠️ USDB download started but no song ID returned, batch ID:', batchId);
            // Fallback: mark as downloading without song ID
            setUsdbBatchResults(prev => prev.map((result, index) => 
              index === i ? { 
                ...result, 
                status: 'downloading',
                message: t('usdbDownloadModal.downloadStarted')
              } : result
            ));
          }
          
        } catch (error: any) {
          console.error('❌ Error starting USDB download:', error);
          const errorMessage = error.response?.data?.message || t('usdbDownloadModal.downloadError');
          setUsdbBatchResults(prev => prev.map((result, index) => 
            index === i ? { 
              ...result, 
              status: 'failed', 
              message: errorMessage
            } : result
          ));
        }
        
        // Wait for this download to reach "separating" status before starting the next one
        if (i < validUrls.length - 1) {
          console.log(`⏳ Waiting for download ${i} to reach "separating" status before starting next...`);
          
          // Wait for the current download to reach "separating" status
          await new Promise<void>((resolve) => {
            const checkStatus = () => {
              const currentBatchId = `usdb-${modalSessionId}-${i}`;
              const currentStatus = downloadStatusRef.current.get(currentBatchId);
              
              if (currentStatus === 'separating') {
                console.log(`✅ Download ${i} reached "separating" status, waiting additional 5 seconds before starting next download`);
                // Additional 5 second delay for rate limiting
                setTimeout(() => {
                  console.log(`🚀 Starting next download after 5 second delay`);
                  resolve();
                }, 5000);
              } else if (currentStatus === 'finished' || currentStatus === 'failed') {
                console.log(`⚠️ Download ${i} finished/failed without reaching "separating", waiting 5 seconds before starting next download anyway`);
                // Still wait 5 seconds even if it finished/failed
                setTimeout(() => {
                  console.log(`🚀 Starting next download after 5 second delay (fallback)`);
                  resolve();
                }, 5000);
              } else {
                // Check again in 1 second
                setTimeout(checkStatus, 1000);
              }
            };
            checkStatus();
          });
        }
      }
      
      console.log('🚀 All USDB downloads started, waiting for WebSocket updates...');
      toast.success(t('usdbDownloadModal.batchDownloadStarted', { count: validUrls.length }));
      
      // Don't clear the results immediately - let WebSocket updates handle the status changes
      // The downloads will continue in the background and update via WebSocket
      
    } catch (error) {
      console.error('Error in batch download:', error);
      toast.error(t('usdbDownloadModal.batchDownloadError'));
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
    let addedIndex = -1;
    
    if (newUrls[newUrls.length - 1] === '') {
      // Replace empty last field
      newUrls[newUrls.length - 1] = song.url;
      addedIndex = newUrls.length - 1;
    } else {
      // Add new field
      newUrls.push(song.url);
      addedIndex = newUrls.length - 1;
    }
    
    // Always add an empty field at the end for new entries
    newUrls.push('');
    setUsdbBatchUrls(newUrls);

    // Remove from search results
    setUsdbSearchResults(prev => prev.filter(s => s.id !== song.id));
    
    // If downloads are currently running, start downloading the new song immediately
    if (usdbBatchDownloading && addedIndex >= 0) {
      console.log('🚀 Song added from search during download, starting additional download:', song.url);
      startAdditionalDownload(song.url, addedIndex);
    }
    
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
                        
                        {/* Status Badge */}
                        {usdbBatchResults[index] && usdbBatchResults[index].status !== 'pending' && (
                          <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            zIndex: 10
                          }}>
                            <DownloadStatusBadge status={usdbBatchResults[index].status as DownloadStatus} />
                          </div>
                        )}
                        
                        {/* Pending indicator */}
                        {usdbBatchResults[index] && usdbBatchResults[index].status === 'pending' && (
                          <div style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: '18px'
                          }}>
                            ⏳
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