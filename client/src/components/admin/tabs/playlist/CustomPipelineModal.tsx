import React, { useState } from 'react';
import { Modal, ModalButtons } from '../../../shared/style';
import Button from '../../../shared/Button';
import { useTranslation } from 'react-i18next';
import { adminAPI } from '../../../../services/api';

interface CustomPipelineModalProps {
  show: boolean;
  onClose: () => void;
  youtubeUrl: string;
}

interface PipelineStep {
  id: string;
  label: string;
  description: string;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: 'youtube_download',
    label: 'YouTube Download',
    description: 'Video von YouTube herunterladen'
  },
  {
    id: 'audio_normalization',
    label: 'Audio Normalisierung',
    description: 'Audio extrahieren und normalisieren'
  },
  {
    id: 'audio_separation',
    label: 'Audio Separation',
    description: 'Gesang von Instrumental trennen'
  },
  {
    id: 'dereverb',
    label: 'Dereverb',
    description: 'Hall aus dem Audio entfernen'
  },
  {
    id: 'video_remuxing',
    label: 'Video Remuxing',
    description: 'Audio aus Video entfernen'
  },
  {
    id: 'transcription',
    label: 'Transkription',
    description: 'Text aus Audio generieren'
  },
  {
    id: 'cleanup',
    label: 'Cleanup',
    description: 'Temporäre Dateien aufräumen'
  }
];

const CustomPipelineModal: React.FC<CustomPipelineModalProps> = ({
  show,
  onClose,
  youtubeUrl,
}) => {
  const { t } = useTranslation();
  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleStep = (stepId: string) => {
    setSelectedSteps(prev =>
      prev.includes(stepId)
        ? prev.filter(id => id !== stepId)
        : [...prev, stepId]
    );
  };

  const handleStart = async () => {
    if (selectedSteps.length === 0) {
      alert('Bitte wählen Sie mindestens einen Schritt aus.');
      return;
    }

    setLoading(true);
    try {
      const response = await adminAPI.processCustomPipeline(youtubeUrl, selectedSteps);
      console.log('Custom Pipeline response:', response);
      alert('Custom Pipeline erfolgreich gestartet!');
      onClose();
      setSelectedSteps([]);
    } catch (error: any) {
      console.error('Error starting custom pipeline:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        data: error.response?.data
      });
      const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unbekannter Fehler';
      alert(`Fehler: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <Modal>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 20px 15px 20px',
          borderBottom: '1px solid #eee',
          flexShrink: 0
        }}>
          <h3 style={{ margin: 0, color: '#333' }}>🔧 Custom Pipeline</h3>
          <Button
            onClick={onClose}
            type="default"
            size="small"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              padding: '0',
              minWidth: 'auto'
            }}
          >
            ×
          </Button>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          minHeight: 0
        }}>
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>
              <strong>YouTube URL:</strong> {youtubeUrl || 'Nicht angegeben'}
            </p>
            <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
              Wählen Sie die gewünschten Verarbeitungsschritte aus:
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {PIPELINE_STEPS.map(step => (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                style={{
                  padding: '15px',
                  border: `2px solid ${selectedSteps.includes(step.id) ? '#4CAF50' : '#ddd'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedSteps.includes(step.id) ? '#f0f8f0' : 'white',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSteps.includes(step.id)}
                  onChange={() => toggleStep(step.id)}
                  style={{
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    color: '#333'
                  }}>
                    {step.label}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#666'
                  }}>
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: '20px',
          borderTop: '1px solid #eee',
          flexShrink: 0
        }}>
          <ModalButtons>
            <Button
              onClick={onClose}
              disabled={loading}
              type="default"
              size="small"
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleStart}
              disabled={loading || selectedSteps.length === 0}
              size="small"
            >
              {loading ? 'Starte...' : 'Starten'}
            </Button>
          </ModalButtons>
        </div>
      </div>
    </Modal>
  );
};

export default CustomPipelineModal;
