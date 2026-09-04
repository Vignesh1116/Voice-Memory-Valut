import { useState } from 'react';
import { Star, Calendar, Volume2, FileText, Copy, Edit, Trash2, Download } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import { updateMemory, deleteMemory as localDeleteMemory } from '../services/localDb';

export default function MemoryCard({ memory, index, onEdit, refreshData, activeAudioId, setActiveAudioId }) {
  const isFavorite = memory.is_favorite;
  const formattedDate = new Date(memory.created_at).toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit', hour12: true
  });

  const toggleFavorite = async () => {
    try {
      await updateMemory(memory.id, { is_favorite: !isFavorite });
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMemory = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this voice memory?')) return;
    try {
      await localDeleteMemory(memory.id);
      refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  const copyTranscript = () => {
    if (memory.notes) {
      navigator.clipboard.writeText(memory.notes);
      alert('Copied to clipboard!');
    }
  };

  const handleDownload = async () => {
    try {
      import('../services/localDb').then(async ({ getMemoryAudioUrl }) => {
        const targetSrc = memory.filepath || (memory.filename ? `/uploads/${memory.filename}` : null);
        if (!targetSrc) {
          alert('Audio file path not found');
          return;
        }

        const audioUrl = await getMemoryAudioUrl(targetSrc);
        if (!audioUrl) {
          alert('Could not locate audio file for download');
          return;
        }

        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const cleanTitle = (memory.title || 'voice-memory').replace(/[^a-z0-9_-]/gi, '_');
        const ext = targetSrc.includes('.mp4') ? 'mp4' : (targetSrc.includes('.wav') ? 'wav' : 'webm');
        const fileName = `${cleanTitle}.${ext}`;

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          document.body.removeChild(a);
        }, 1000);
      });
    } catch (err) {
      console.error('Download error:', err);
      const fallbackUrl = memory.filepath || (memory.filename ? `/uploads/${memory.filename}` : null);
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank');
      }
    }
  };

  return (
    <div className="memory-card stagger-enter" style={{ animationDelay: `${index * 0.08}s` }}>
      <div>
        <div className="memory-card-header">
          <span className="memory-tag-badge">{memory.tags && memory.tags.length > 0 ? memory.tags[0] : '🎙️ Voice Memory'}</span>
          <button 
            className={`btn-star ${isFavorite ? 'active' : ''}`} 
            onClick={toggleFavorite}
          >
            <Star size={20} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        <h3 className="memory-title">{memory.title}</h3>
        <div className="memory-date"><Calendar size={14} /> {formattedDate}</div>
      </div>

      <div className="memory-media-container">
        <div className="media-section-header">
          <span className="media-badge"><Volume2 size={14} /> Recorded Voice</span>
        </div>
        
        <AudioPlayer 
          id={memory.id} 
          src={memory.filepath || (memory.filename ? `/uploads/${memory.filename}` : null)} 
          duration={memory.duration} 
          isActive={activeAudioId === memory.id}
          setActive={() => setActiveAudioId(memory.id)}
          clearActive={() => { if(activeAudioId === memory.id) setActiveAudioId(null); }}
        />

        <div className="media-section-header mt-3">
          <span className="media-badge"><FileText size={14} /> Text Transcript</span>
          {memory.notes && memory.notes.trim() !== '' && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn-copy-mini" onClick={copyTranscript} title="Copy text">
                <Copy size={12} /> Copy
              </button>
            </div>
          )}
        </div>
        <div className="memory-transcript-box">
          <div className="transcript-content">
            {memory.notes && memory.notes.trim() !== '' 
              ? memory.notes 
              : <em style={{color: 'var(--text-dim)'}}>No text transcript recorded yet.</em>}
          </div>
        </div>
      </div>

      <div className="memory-footer">
        <button className="btn-action" onClick={() => onEdit(memory)}>
          <Edit size={16} style={{display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom'}} /> Edit
        </button>
        <button className="btn-action" onClick={handleDownload}>
          <Download size={16} style={{display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom'}} /> Download
        </button>
        <button className="btn-action btn-delete" onClick={deleteMemory}>
          <Trash2 size={16} style={{display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom'}} /> Delete
        </button>
      </div>
    </div>
  );
}
