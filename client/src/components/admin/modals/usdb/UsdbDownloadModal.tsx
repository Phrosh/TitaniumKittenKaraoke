import React, { useEffect } from 'react';
import styled from 'styled-components';
import {adminAPI} from '../../../../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface Progress {
  current: number;
  total: number;
}

interface USDBDownloadModalProps {
  show: boolean;
//   usdbBatchUrls: string[];
//   usdbBatchDownloading: boolean;
//   usdbBatchCurrentDownloading: number | null;
//   usdbBatchProgress: Progress;
//   onClose: () => void;
//   onBatchUrlChange: (index: number, value: string) => void;
//   onAddBatchUrlField: () => void;
//   onRemoveBatchUrlField: (index: number) => void;
//   onStartBatchDownload: () => void;
//   onOpenAddSongSearch?: () => void;
//   handleRemoveBatchUrlField: (index: number) => void;
//   handleBatchUrlChange: (index: number, value: string) => void;
//   usdbBatchResults: any[];
//   handleBatchDownloadFromUSDB: () => Promise<void>;
//   usdbSearchInterpret: string;
//   setUsdbSearchInterpret: (value: string) => void;
//   usdbSearchTitle: string;
//   setUsdbSearchTitle: (value: string) => void;
//   usdbSearchResults: any[];
//   handleAddSearchResultToDownload: (result: any) => void;
//   handleSearchUSDB: () => Promise<void>;
//   usdbSearchLoading: boolean;
  fetchSongs: () => void;
  handleCloseUsdbDialog: () => void;
}

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Card = styled.div`
  background-color: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 1200px;
  width: 95%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
`;

const Title = styled.h3`
  margin: 0 0 20px 0;
  color: #333;
  font-size: 20px;
  font-weight: 600;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  min-height: 500px;
`;

const Section = styled.div<{ muted?: boolean }>`
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  padding: 20px;
  background-color: ${({ muted }) => (muted ? 'white' : '#f8f9fa')};
`;

const SectionTitle = styled.h4`
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
`;

const ProgressWrap = styled.div`
  margin-bottom: 20px;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background-color: #e1e5e9;
  border-radius: 4px;
  overflow: hidden;
`;

const ProgressInner = styled.div<{ percent: number }>`
  width: ${({ percent }) => `${percent}%`};
  height: 100%;
  background-color: #6f42c1;
  transition: width 0.3s ease;
`;

const UrlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
`;

const UrlInput = styled.input<{ disabled?: boolean }>`
  flex: 1;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  font-size: 14px;
  background-color: ${({ disabled }) => (disabled ? '#f8f9fa' : 'white')};
  color: ${({ disabled }) => (disabled ? '#666' : '#333')};
  &:focus { border-color: #667eea; outline: none; }
`;

const IconButton = styled.button<{ danger?: boolean; disabled?: boolean }>`
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background-color: ${({ danger, disabled }) => (disabled ? '#f8f9fa' : danger ? '#dc3545' : '#e9ecef')};
  color: ${({ disabled }) => (disabled ? '#ccc' : 'white')};
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const AddUrlButton = styled.button<{ disabled?: boolean }>`
  width: 100%;
  padding: 12px;
  border: 2px dashed #6f42c1;
  border-radius: 6px;
  background: transparent;
  color: ${({ disabled }) => (disabled ? '#ccc' : '#6f42c1')};
  font-size: 14px;
  font-weight: 600;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
`;

const PrimaryButton = styled.button<{ disabled?: boolean }>`
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 6px;
  background-color: ${({ disabled }) => (disabled ? '#ccc' : '#28a745')};
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
`;

const GhostButton = styled.button<{ disabled?: boolean }>`
  width: 100%;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 6px;
  background: white;
  color: #666;
  font-size: 14px;
  font-weight: 600;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
`;

const Footer = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e1e5e9;
`;

const USDBDownloadModal: React.FC<USDBDownloadModalProps> = ({
  show,
//   usdbBatchUrls,
//   usdbBatchDownloading,
//   usdbBatchCurrentDownloading,
//   usdbBatchProgress,
//   handleRemoveBatchUrlField,
//   handleBatchUrlChange,
//   usdbBatchResults,
//   handleBatchDownloadFromUSDB,
//   usdbSearchInterpret,
//   setUsdbSearchInterpret,
//   usdbSearchTitle,
//   setUsdbSearchTitle,
//   usdbSearchResults,
//   handleAddSearchResultToDownload,
//   handleSearchUSDB,
//   usdbSearchLoading,
  fetchSongs,
  handleCloseUsdbDialog
}) => {
    const [usdbBatchDownloading, setUsdbBatchDownloading] = useState(false);
    const [usdbBatchProgress, setUsdbBatchProgress] = useState({ current: 0, total: 0 });
    const [usdbBatchResults, setUsdbBatchResults] = useState<Array<{url: string, status: 'pending' | 'downloading' | 'completed' | 'error', message?: string}>>([]);
    const [usdbBatchCurrentDownloading, setUsdbBatchCurrentDownloading] = useState<number | null>(null);

    const [usdbSearchInterpret, setUsdbSearchInterpret] = useState('');
    const [usdbSearchTitle, setUsdbSearchTitle] = useState('');
    const [usdbSearchResults, setUsdbSearchResults] = useState<Array<{id: number, artist: string, title: string, url: string}>>([]);
    const [usdbSearchLoading, setUsdbSearchLoading] = useState(false);
    const [usdbUrl, setUsdbUrl] = useState('');
    const [usdbDownloading, setUsdbDownloading] = useState(false);

    const [usdbBatchUrls, setUsdbBatchUrls] = useState<string[]>(['']);

    const [oldDownloadUrls, setOldDownloadUrls] = useState([]);

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
          toast('Song aus Download-Liste entfernt');
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
  
    useEffect(() => {
      if (oldDownloadUrls.length > 0) {
        const urls = usdbBatchUrls.filter((url: string) => !oldDownloadUrls.includes(url));
        setUsdbBatchUrls(urls);
        setOldDownloadUrls([]);
        setUsdbBatchCurrentDownloading(null);
        handleBatchDownloadFromUSDB(null, urls);
      }
    }, [oldDownloadUrls]);
  
    // const percent = usdbBatchProgress.total > 0 ? (usdbBatchProgress.current / usdbBatchProgress.total) * 100 : 0;
    // const disableStart = usdbBatchDownloading || usdbBatchUrls.some((u) => !u.trim());

    const handleBatchDownloadFromUSDB = async (event?: React.MouseEvent, urls?: string[]) => {
        // Filter out empty URLs
        console.log("urls", urls, usdbBatchUrls);
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
                  message: response.data.message || 'Download erfolgreich'
                } : result
              ));
              
              // Update progress
              setUsdbBatchProgress({ current: i + 1, total: validUrls.length });
              
            } catch (error: any) {
              // Mark as error
              const errorMessage = error.response?.data?.message || 'Fehler beim Download';
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
          toast.success(`Batch-Download abgeschlossen: ${validUrls.length} Songs verarbeitet`);
          
          // Rescan song list
          try {
            await adminAPI.rescanFileSongs();
            await fetchSongs();
          } catch (rescanError) {
            console.error('Error rescanning after batch download:', rescanError);
          }
          
          // Close modal after successful completion
          // setShowUsdbDialog(false);
          // setUsdbBatchUrls(['']);
          setOldDownloadUrls(validUrls);
          setUsdbBatchProgress({ current: 0, total: 0 });
          setUsdbBatchResults([]);
          // setUsdbDownloadFinished(true);
        } catch (error) {
          console.error('Error in batch download:', error);
          toast.error('Fehler beim Batch-Download');
        } finally {
          setUsdbBatchDownloading(false);
          setUsdbBatchCurrentDownloading(null);
        }
      };

      const handleSearchUSDB = async () => {
        if (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim()) {
          toast.error('Bitte Interpret oder Titel eingeben');
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
            toast('Keine Songs gefunden');
          } else {
            toast.success(`${songs.length} Songs gefunden`);
          }
        } catch (error: any) {
          console.error('Error searching USDB:', error);
          const message = error.response?.data?.message || 'Fehler bei der USDB-Suche';
          toast.error(message);
        } finally {
          setUsdbSearchLoading(false);
        }
      };

      const handleRemoveSearchResult = (songId: number) => {
        setUsdbSearchResults(prev => prev.filter(s => s.id !== songId));
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
    
      const handleAddSearchResultToDownload = (song: {id: number, artist: string, title: string, url: string}) => {
        // Check if URL already exists in batch list
        const urlExists = usdbBatchUrls.some(url => url.trim() === song.url);
        
        if (urlExists) {
          toast('Dieser Song ist bereits in der Download-Liste');
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
        
        toast.success(`${song.artist} - ${song.title} zur Download-Liste hinzugefügt`);
      };

    if (!show) return null;

    return (<div style={{
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
            🌐 USDB Song Management
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
                📥 Batch-Download
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
                      Fortschritt:
                    </span>
                    <span style={{ fontSize: '14px', color: '#666' }}>
                      {usdbBatchProgress.current} / {usdbBatchProgress.total} Downloads
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
                  USDB-URLs (füge beliebig viele hinzu):
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
                      <button
                        onClick={() => handleRemoveBatchUrlField(index)}
                        disabled={usdbBatchCurrentDownloading === index}
                        style={{
                          width: '32px',
                          height: '32px',
                          border: 'none',
                          borderRadius: '6px',
                          backgroundColor: usdbBatchDownloading ? '#f8f9fa' : '#dc3545',
                          color: usdbBatchDownloading ? '#ccc' : 'white',
                          cursor: usdbBatchDownloading ? 'not-allowed' : 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          flexShrink: 0
                        }}
                        onMouseEnter={(e) => {
                          if (!usdbBatchDownloading) {
                            e.currentTarget.style.backgroundColor = '#c82333';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!usdbBatchDownloading) {
                            e.currentTarget.style.backgroundColor = '#dc3545';
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                      >
                        ×
                      </button>
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
                <button
                  onClick={handleBatchDownloadFromUSDB}
                  disabled={usdbBatchDownloading || usdbBatchUrls.filter(url => url.trim()).length === 0}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: usdbBatchDownloading || usdbBatchUrls.filter(url => url.trim()).length === 0 ? '#ccc' : '#6f42c1',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: usdbBatchDownloading || usdbBatchUrls.filter(url => url.trim()).length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!usdbBatchDownloading && usdbBatchUrls.filter(url => url.trim()).length > 0) {
                      e.currentTarget.style.backgroundColor = '#5a2d91';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!usdbBatchDownloading && usdbBatchUrls.filter(url => url.trim()).length > 0) {
                      e.currentTarget.style.backgroundColor = '#6f42c1';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {usdbBatchDownloading ? '⏳ Downloads laufen...' : '🌐 Batch-Download starten'}
                </button>
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
                🔍 Song-Suche
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
                      Interpret:
                    </label>
                    <input
                      type="text"
                      value={usdbSearchInterpret}
                      onChange={(e) => setUsdbSearchInterpret(e.target.value)}
                      placeholder="z.B. ABBA"
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
                      Titel (optional):
                    </label>
                    <input
                      type="text"
                      value={usdbSearchTitle}
                      onChange={(e) => setUsdbSearchTitle(e.target.value)}
                      placeholder="z.B. The Winner Takes It All"
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
  
                <button
                  onClick={handleSearchUSDB}
                  disabled={usdbSearchLoading || (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim())}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: usdbSearchLoading || (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim()) ? '#ccc' : '#28a745',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: usdbSearchLoading || (!usdbSearchInterpret.trim() && !usdbSearchTitle.trim()) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!usdbSearchLoading && (usdbSearchInterpret.trim() || usdbSearchTitle.trim())) {
                      e.currentTarget.style.backgroundColor = '#218838';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!usdbSearchLoading && (usdbSearchInterpret.trim() || usdbSearchTitle.trim())) {
                      e.currentTarget.style.backgroundColor = '#28a745';
                    }
                  }}
                >
                  {usdbSearchLoading ? '⏳ Suche läuft...' : '🔍 Suchen'}
                </button>
              </div>
  
              {/* Search Results */}
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {usdbSearchResults.length > 0 ? (
                  <div>
                    <div style={{ marginBottom: '10px', fontSize: '14px', fontWeight: '600', color: '#333' }}>
                      Gefundene Songs ({usdbSearchResults.length}):
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
                    {usdbSearchLoading ? 'Suche läuft...' : 'Keine Suchergebnisse'}
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
            <button
              onClick={async () => {
                handleCloseUsdbDialog();
                setUsdbUrl('');
                // Reset batch states
                setUsdbBatchUrls(['']);
                setUsdbBatchDownloading(false);
                setUsdbBatchProgress({ current: 0, total: 0 });
                setUsdbBatchResults([]);
                setUsdbBatchCurrentDownloading(null);
                
                try {
                    // First rescan file system songs (includes USDB downloads)
                    await adminAPI.rescanFileSongs();
                    
                    // Then fetch all songs to update the UI
                    await fetchSongs();
                    
                    toast.success('Songliste wurde aktualisiert');
                } catch (error) {
                    console.error('Error refreshing song list:', error);
                    // Don't show error toast as this is a background operation
                }

              }}
              disabled={usdbBatchDownloading}
              style={{
                padding: '12px 24px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                backgroundColor: usdbBatchDownloading ? '#f8f9fa' : 'white',
                color: usdbBatchDownloading ? '#ccc' : '#666',
                fontSize: '14px',
                fontWeight: '500',
                cursor: usdbBatchDownloading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!usdbBatchDownloading) {
                  e.currentTarget.style.borderColor = '#ccc';
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (!usdbBatchDownloading) {
                  e.currentTarget.style.borderColor = '#e1e5e9';
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
            >
              Schließen
            </button>
          </div>
        </div>
      </div>);

};

export default USDBDownloadModal;