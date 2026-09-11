import { useState, useRef, useEffect } from 'react';
import { X, Mic, UploadCloud, Edit as EditIcon, Play, Pause, Save, Star } from 'lucide-react';
import { saveMemory, updateMemory } from '../services/localDb';

export default function Modals({ activeModal, closeModal, refreshData, editingMemory }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [tag, setTag] = useState('🎙️ Voice Memory');
  const [interimNotes, setInterimNotes] = useState('');
  const [sttLanguage, setSttLanguage] = useState(navigator.language || 'en-US');
  const [isSttActive, setIsSttActive] = useState(false);
  const transcriptBufferRef = useRef('');
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  
  // Upload State
  const [selectedFile, setSelectedFile] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordedBlobRef = useRef(null);
  const timerRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  // Transcription Worker State
  const workerRef = useRef(null);
  const [transcribeStatus, setTranscribeStatus] = useState(null); // 'decoding', 'loading_model', 'processing', 'complete', 'error'
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeErrorMsg, setTranscribeErrorMsg] = useState('');
  const [transcribeLanguage, setTranscribeLanguage] = useState('auto');

  // LocalStorage API Key check happens inside the function

  const handleTranscribeAudio = async (blobInput = null) => {
    const blobToTranscribe = blobInput || recordedBlobRef.current || recordedBlob;
    if (!blobToTranscribe) return;

    try {
      setTranscribeStatus('processing');
      setTranscribeErrorMsg('');

      const actualMimeType = blobToTranscribe.type || 'audio/webm';
      let extension = 'webm';
      if (actualMimeType.includes('mp4')) extension = 'mp4';
      if (actualMimeType.includes('wav')) extension = 'wav';
      if (actualMimeType.includes('ogg')) extension = 'ogg';

      const formData = new FormData();
      formData.append('audio', blobToTranscribe, `audio.${extension}`);
      const selectedLang = sttLanguage || transcribeLanguage || 'auto';
      if (selectedLang && selectedLang !== 'auto') {
        const isoLang = selectedLang.split('-')[0].toLowerCase();
        formData.append('language', isoLang);
      }

      let apiKey = localStorage.getItem('groq_api_key') || '';
      const headers = {};
      if (apiKey) {
        headers['x-groq-key'] = apiKey;
      }

      // 1. Try server endpoint first
      const serverRes = await fetch('/api/transcribe', {
        method: 'POST',
        headers,
        body: formData
      }).catch(() => null);

      if (serverRes && serverRes.ok) {
        const result = await serverRes.json();
        if (result.text) {
          setTranscribeStatus('complete');
          setNotes(prev => (prev ? prev + ' ' : '') + result.text.trim());
          return;
        }
      }

      // 2. Direct Groq API fallback ONLY IF key stored in localStorage (NEVER prompt user)
      if (apiKey) {
        const groqFormData = new FormData();
        groqFormData.append('file', blobToTranscribe, `audio.${extension}`);
        groqFormData.append('model', 'whisper-large-v3');
        groqFormData.append('temperature', '0');
        groqFormData.append('prompt', 'Transcribe spoken Tamil, Tanglish (Tamil code-switched with English), Hindi, and English audio accurately into text. தமிழ் பேச்சு வார்த்தைகளை துல்லியமாக எழுதவும்.');
        if (selectedLang && selectedLang !== 'auto') {
          const isoLang = selectedLang.split('-')[0].toLowerCase();
          groqFormData.append('language', isoLang);
        }

        const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey.trim()}` },
          body: groqFormData
        }).catch(() => null);

        if (groqRes && groqRes.ok) {
          const result = await groqRes.json();
          setTranscribeStatus('complete');
          setNotes(prev => (prev ? prev + ' ' : '') + result.text.trim());
          return;
        }
      }

      // If transcription is not configured or unavailable, complete silently
      setTranscribeStatus(null);

    } catch (err) {
      console.warn("Transcription handled silently:", err);
      setTranscribeStatus(null);
    }
  };

  // Initialize Edit state
  useEffect(() => {
    if (activeModal === 'edit' && editingMemory) {
      setTitle(editingMemory.title || '');
      setNotes(editingMemory.notes || '');
      transcriptBufferRef.current = editingMemory.notes || '';
      setIsFavorite(editingMemory.is_favorite || false);
      if (editingMemory.tags && editingMemory.tags.length > 0) {
        setTag(editingMemory.tags[0]);
      }
    } else if (activeModal === 'record' || activeModal === 'upload') {
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      setTitle(`Voice Recording - ${dateStr}, ${timeStr}`);
      if (activeModal === 'record') {
        setNotes('');
        transcriptBufferRef.current = '';
        recordedBlobRef.current = null;
        setRecordedBlob(null);
      }
    }
  }, [activeModal, editingMemory]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      clearInterval(timerRef.current);
    };
  }, []);

  const getSupportedMimeType = () => {
    if (typeof window === 'undefined' || !window.MediaRecorder) return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/mpeg',
      'audio/ogg'
    ];
    for (const type of types) {
      try {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
          return type;
        }
      } catch (e) {}
    }
    return '';
  };

  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          alert('Microphone access requires HTTPS on mobile devices. Please deploy/access this app via HTTPS.');
        } else {
          alert('Audio recording is not supported on this browser/device.');
        }
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordedBlobRef.current = null;
      setRecordedBlob(null);
      setTranscribeStatus(null);
      setTranscribeErrorMsg('');

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        recordedBlobRef.current = blob;
        setRecordedBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());

        // Always trigger automatic Whisper AI voice transcription on recording completion
        if (blob && blob.size > 0) {
          handleTranscribeAudio(blob);
        }
      };

      // Native start without timeslice to avoid WebKit / iOS Safari 0-byte chunk bug
      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordSeconds(0);
      transcriptBufferRef.current = '';
      
      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error("Recording error:", err);
      let errMsg = 'Could not access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errMsg = 'Microphone access was denied. Please allow microphone permissions in your browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = 'No microphone device found on this device.';
      }
      alert(errMsg);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsPaused(false);
      clearInterval(timerRef.current);
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch(e){}
        setIsSttActive(false);
      }
      if (transcriptBufferRef.current) {
        setNotes(transcriptBufferRef.current);
      }
    }
  };

  const handleSaveRecord = async (e) => {
    if (e) e.preventDefault();

    // If user clicks Save while active recording, auto-stop first and wait for onstop
    if (isRecordingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise((resolve) => {
        if (mediaRecorderRef.current) {
          const prevOnStop = mediaRecorderRef.current.onstop;
          mediaRecorderRef.current.onstop = (evt) => {
            if (prevOnStop) prevOnStop(evt);
            resolve();
          };
          handleStopRecording();
        } else {
          resolve();
        }
      });
      await new Promise(r => setTimeout(r, 100));
    }

    let blobToSave = recordedBlobRef.current || recordedBlob;

    if ((!blobToSave || blobToSave.size === 0) && audioChunksRef.current.length > 0) {
      const mime = (mediaRecorderRef.current && mediaRecorderRef.current.mimeType) || getSupportedMimeType() || 'audio/webm';
      blobToSave = new Blob(audioChunksRef.current, { type: mime });
    }

    if (!blobToSave || blobToSave.size === 0) {
      alert('No recorded audio found. Please record audio before saving.');
      return;
    }
    
    const memoryData = {
      title: title || `Voice Memory - ${new Date().toLocaleDateString()}`,
      duration: String(recordSeconds || 0),
      tags: [tag],
      is_favorite: isFavorite,
      notes
    };

    try {
      await saveMemory(memoryData, blobToSave);
      refreshData();
      closeModal();
    } catch (err) {
      console.error('Save memory error:', err);
      if (err.message && err.message.includes('dynamically imported module')) {
          alert('Updating app to the latest version... Please try saving again in a moment!');
          window.location.reload();
          return;
      }
      alert('Failed to save memory: ' + (err.message || 'Unknown error'));
    }
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const memoryData = {
      title,
      duration: '0',
      tags: [tag],
      is_favorite: isFavorite,
      notes
    };

    try {
      await saveMemory(memoryData, selectedFile);
      refreshData();
      closeModal();
    } catch (err) {
      console.error(err);
      if (err.message && err.message.includes('dynamically imported module')) {
          alert('Updating app to the latest version... Please try saving again in a moment!');
          window.location.reload();
          return;
      }
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const payload = { title, notes, is_favorite: isFavorite, tags: [tag] };

    try {
      await updateMemory(editingMemory.id, payload);
      refreshData();
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="mobile-drag-handle"></div>
        
        {/* Header */}
        <div className="modal-header">
          <h2>
            {activeModal === 'record' && <><Mic size={18} className="text-cyan" style={{display:'inline', marginRight:'8px'}} /> Record Voice Memory</>}
            {activeModal === 'upload' && <><UploadCloud size={18} className="text-violet" style={{display:'inline', marginRight:'8px'}} /> Upload Audio File</>}
            {activeModal === 'edit' && <><EditIcon size={18} className="text-golden" style={{display:'inline', marginRight:'8px'}} /> Edit Memory Details</>}
          </h2>
          <button className="btn-close" onClick={closeModal}><X size={20} /></button>
        </div>

        {/* Form Container wrapping both body and footer for native mobile submit support */}
        <form id="modal-form" className="modal-form-container" onSubmit={
          activeModal === 'record' ? handleSaveRecord : 
          activeModal === 'upload' ? handleUploadFile : 
          handleSaveEdit
        }>
          {/* Body */}
          <div className="modal-body">
            
            {/* RECORD SECTION */}
            {activeModal === 'record' && (
              <div className="text-center mb-6">
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600' }}>Spoken Language:</label>
                  <select 
                    className="glass-select" 
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    value={sttLanguage} 
                    onChange={e => setSttLanguage(e.target.value)}
                    disabled={isRecording}
                  >
                    <option value="en-US">English (US)</option>
                    <option value="en-IN">English (India)</option>
                    <option value="hi-IN">Hindi (हिंदी)</option>
                    <option value="ta-IN">Tamil (தமிழ்)</option>
                    <option value="te-IN">Telugu (తెలుగు)</option>
                    <option value="ml-IN">Malayalam (മലയാളം)</option>
                    <option value="mr-IN">Marathi (मराठी)</option>
                    <option value="bn-IN">Bengali (বাংলা)</option>
                    <option value="es-ES">Spanish (Español)</option>
                  </select>
                </div>

                <div className="recorder-display">
                  {isRecording && (
                    <div className="recording-status">
                      <span className="pulse-dot"></span> Recording Voice Live...
                    </div>
                  )}
                  <div className="recording-timer">{formatTime(recordSeconds)}</div>
                  
                  {audioUrl && !isRecording && (
                    <audio src={audioUrl} controls className="w-full mt-4" />
                  )}
                </div>
                <div className="recorder-controls">
                  {!isRecording && !audioUrl && (
                    <button type="button" className="btn-record-start" onClick={handleStartRecording}>Start Recording</button>
                  )}
                  {isRecording && (
                    <button type="button" className="btn-record-stop" onClick={handleStopRecording}>Stop & Done</button>
                  )}
                  {!isRecording && audioUrl && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <button type="button" className="btn-record-start" onClick={handleStartRecording}>Record Again</button>
                          {(!transcribeStatus || transcribeStatus === 'error') && (
                              <button type="button" className="btn-save" onClick={() => handleTranscribeAudio(recordedBlob)} style={{ background: '#6366f1' }}>
                                  ✨ Auto Transcribe
                              </button>
                          )}
                      </div>
                    </div>
                  )}
                  {transcribeStatus === 'processing' && (
                      <div style={{ marginTop: '15px', color: '#38bdf8', fontSize: '0.9rem', textAlign: 'center', fontWeight: '600' }}>
                          ✨ Transcribing voice to text...
                      </div>
                  )}
                </div>
              </div>
            )}

            {/* UPLOAD SECTION */}
            {activeModal === 'upload' && (
              <div className="dropzone mb-6">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if(file) {
                      setSelectedFile(file);
                      if(!title || title.startsWith('Voice Recording')) setTitle(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }} 
                  style={{display: 'block', margin: '0 auto 10px'}}
                />
                <p className="drop-hint">Supports MP3, WAV, WebM, OGG, M4A (Max 50MB)</p>
              </div>
            )}

            {/* SHARED INPUT FIELDS */}
            <div className="form-group">
              <label>Memory Title *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Category</label>
                <select className="glass-select w-full" value={tag} onChange={e => setTag(e.target.value)}>
                  <option value="🎙️ Voice Memory">🎙️ Voice Memory</option>
                  <option value="🎵 Music Idea">🎵 Music Idea</option>
                  <option value="📝 Meeting Notes">📝 Meeting Notes</option>
                </select>
              </div>
              <div className="form-group flex-1 flex items-center justify-end pt-6">
                <label className="fav-checkbox-label">
                  <input type="checkbox" checked={isFavorite} onChange={e => setIsFavorite(e.target.checked)} />
                  <span className="star-toggle"><Star size={14} style={{display:'inline', marginRight:'4px', verticalAlign:'text-bottom'}}/> Favorite</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Text Transcription / Notes</label>
              <textarea 
                rows="3" 
                value={notes + (interimNotes ? (notes ? ' ' : '') + interimNotes : '')} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="Spoken words will automatically appear here..."
              ></textarea>
            </div>
          </div>

          {/* Footer - Native Submit Button inside Form */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button 
              type="submit" 
              className="btn btn-primary btn-save-mobile" 
              disabled={
                (activeModal === 'record' && !recordedBlob && !recordedBlobRef.current && !isRecording && audioChunksRef.current.length === 0) || 
                (activeModal === 'upload' && !selectedFile)
              }
            >
              <Save size={18} /> Save Memory
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
