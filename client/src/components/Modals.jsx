import { useState, useRef, useEffect } from 'react';
import { X, Mic, UploadCloud, Edit as EditIcon, Play, Pause, Save, Star } from 'lucide-react';
import { saveMemory, updateMemory } from '../services/localDb';

export default function Modals({ activeModal, closeModal, refreshData, editingMemory }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [tag, setTag] = useState('🎙️ Voice Memory');
  const [interimNotes, setInterimNotes] = useState('');
  
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
  const timerRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(true);

  // Transcription Worker State
  const workerRef = useRef(null);
  const [transcribeStatus, setTranscribeStatus] = useState(null); // 'decoding', 'loading_model', 'processing', 'complete', 'error'
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeErrorMsg, setTranscribeErrorMsg] = useState('');

  useEffect(() => {
    workerRef.current = new Worker(new URL('../transcriberWorker.js', import.meta.url), { type: 'module' });
    
    workerRef.current.addEventListener('message', (event) => {
        const { status, progress, text, error } = event.data;
        if (status === 'progress') {
            setTranscribeStatus('loading_model');
            if (progress && progress.progress) {
                setTranscribeProgress(progress.progress);
            }
        } else if (status === 'processing') {
            setTranscribeStatus('processing');
        } else if (status === 'complete') {
            setTranscribeStatus('complete');
            setTranscribeErrorMsg('');
            setNotes(prev => (prev ? prev + ' ' : '') + text.trim());
        } else if (status === 'error') {
            setTranscribeStatus('error');
            setTranscribeErrorMsg(error || 'Unknown worker error');
            console.error("Transcription error:", error);
        }
    });

    workerRef.current.addEventListener('error', (err) => {
        setTranscribeStatus('error');
        setTranscribeErrorMsg('AI failed to start on this device.');
        console.error("Worker load error:", err);
    });

    return () => {
        workerRef.current.terminate();
    };
  }, []);

  const handleTranscribeAudio = async () => {
      if (!recordedBlob) return;
      try {
          setTranscribeStatus('decoding');
          setTranscribeErrorMsg('');
          const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          const arrayBuffer = await recordedBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const audioData = audioBuffer.getChannelData(0); // Float32Array
          
          workerRef.current.postMessage({
              command: 'transcribe',
              audio: audioData
          });
      } catch (err) {
          console.error("Failed to decode audio", err);
          setTranscribeStatus('error');
          setTranscribeErrorMsg(err.message || 'Failed to decode audio blob');
      }
  };

  // Initialize Edit state
  useEffect(() => {
    if (activeModal === 'edit' && editingMemory) {
      setTitle(editingMemory.title || '');
      setNotes(editingMemory.notes || '');
      setIsFavorite(editingMemory.is_favorite || false);
      if (editingMemory.tags && editingMemory.tags.length > 0) {
        setTag(editingMemory.tags[0]);
      }
    } else if (activeModal === 'record' || activeModal === 'upload') {
      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      setTitle(`Voice Recording - ${dateStr}, ${timeStr}`);
    }
  }, [activeModal, editingMemory]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setNotes(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
        }
        setInterimNotes(interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          const isAndroid = /Android/i.test(navigator.userAgent);
          if (!isAndroid) {
            try { recognition.start(); } catch(e) {}
          }
        }
      };

      speechRecognitionRef.current = recognition;
    } else {
      setIsSpeechSupported(false);
    }
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      clearInterval(timerRef.current);
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        setRecordedBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordSeconds(0);
      
      timerRef.current = setInterval(() => {
        setRecordSeconds(prev => prev + 1);
      }, 1000);
      
      if (speechRecognitionRef.current) {
        const isAndroid = /Android/i.test(navigator.userAgent);
        if (!isAndroid) {
          try { speechRecognitionRef.current.start(); } catch(e){}
        } else {
          console.log("Speech recognition disabled on Android to prevent mic conflict.");
        }
      }
      
    } catch (err) {
      console.error(err);
      alert('Microphone access denied or error occurred.');
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
      }
    }
  };

  const handleSaveRecord = async (e) => {
    e.preventDefault();
    if (!recordedBlob) return;
    
    const memoryData = {
      title,
      duration: String(recordSeconds),
      tags: [tag],
      is_favorite: isFavorite,
      notes
    };

    try {
      await saveMemory(memoryData, recordedBlob);
      refreshData();
      closeModal();
    } catch (err) {
      console.error(err);
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
        
        {/* Header */}
        <div className="modal-header">
          <h2>
            {activeModal === 'record' && <><Mic size={18} className="text-cyan" style={{display:'inline', marginRight:'8px'}} /> Record Voice Memory</>}
            {activeModal === 'upload' && <><UploadCloud size={18} className="text-violet" style={{display:'inline', marginRight:'8px'}} /> Upload Audio File</>}
            {activeModal === 'edit' && <><EditIcon size={18} className="text-golden" style={{display:'inline', marginRight:'8px'}} /> Edit Memory Details</>}
          </h2>
          <button className="btn-close" onClick={closeModal}><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="modal-body">
          
          {/* RECORD SECTION */}
          {activeModal === 'record' && (
            <div className="text-center mb-6">
              {!isSpeechSupported && (
                <div style={{ color: '#f59e0b', fontSize: '0.9rem', marginBottom: '10px' }}>
                  ⚠️ Speech-to-text is not supported in your browser. (Try Google Chrome or Edge)
                </div>
              )}
              <div className="recorder-display">
                {isRecording && <div className="recording-status"><span className="pulse-dot"></span> Recording Live...</div>}
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
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <button type="button" className="btn-record-start" onClick={handleStartRecording}>Record Again</button>
                    {(!transcribeStatus || transcribeStatus === 'error') && (
                        <button type="button" className="btn-save" onClick={handleTranscribeAudio} style={{ background: '#6366f1' }}>
                            Generate Transcript (AI)
                        </button>
                    )}
                  </div>
                )}
                {transcribeStatus && transcribeStatus !== 'complete' && transcribeStatus !== 'error' && (
                    <div style={{ marginTop: '15px', color: '#94a3b8', fontSize: '0.9rem', textAlign: 'center' }}>
                        {transcribeStatus === 'loading_model' && `Downloading AI Model (${Math.round(transcribeProgress)}%)...`}
                        {transcribeStatus === 'decoding' && `Decoding audio...`}
                        {transcribeStatus === 'processing' && `Transcribing...`}
                    </div>
                )}
                {transcribeStatus === 'error' && transcribeErrorMsg && (
                    <div style={{ marginTop: '15px', color: '#ef4444', fontSize: '0.9rem', textAlign: 'center', background: '#451a1a', padding: '8px', borderRadius: '8px' }}>
                        Error: {transcribeErrorMsg}
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

          {/* SHARED FORM (Title, Tag, Favorite, Notes) */}
          <form id="modal-form" onSubmit={
            activeModal === 'record' ? handleSaveRecord : 
            activeModal === 'upload' ? handleUploadFile : 
            handleSaveEdit
          }>
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
                placeholder="Add text notes..."
              ></textarea>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button 
            type="submit" 
            form="modal-form"
            className="btn btn-primary" 
            disabled={(activeModal === 'record' && !recordedBlob) || (activeModal === 'upload' && !selectedFile)}
          >
            <Save size={16} /> Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}
