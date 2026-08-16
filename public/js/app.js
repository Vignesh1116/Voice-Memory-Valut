// State Management
let memories = [];
let currentTag = 'All';
let isFavoriteOnly = false;
let currentSort = 'newest';
let searchQuery = '';

// Active Audio Playback Tracking
let activeAudio = null;
let activePlayBtn = null;
let activeProgressFill = null;
let activeTimeDisplay = null;
const cardSpeeds = {};

// Preview Audio State
let previewAudio = null;
let previewSpeed = 1;
let baseTranscript = '';

// Recording State & Speech-to-Text
let mediaRecorder = null;
let audioChunks = [];
let recordedBlob = null;
let recordTimerInterval = null;
let recordSeconds = 0;
let audioContext = null;
let analyser = null;
let visualizerFrameId = null;
let speechRecognition = null;

// DOM Elements
const grid = document.getElementById('memories-grid');
const spinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const btnFavFilter = document.getElementById('btn-fav-filter');
const sortSelect = document.getElementById('sort-select');
const tagPills = document.querySelectorAll('.category-pills .pill');

// Modals
const modalRecord = document.getElementById('modal-record');
const modalUpload = document.getElementById('modal-upload');
const modalEdit = document.getElementById('modal-edit');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadVault();
});

function initEventListeners() {
  // Navigation & Modals
  document.getElementById('btn-open-record').addEventListener('click', () => openModal(modalRecord));
  document.getElementById('btn-empty-record').addEventListener('click', () => openModal(modalRecord));
  document.getElementById('btn-open-upload').addEventListener('click', () => openModal(modalUpload));
  
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
      stopRecordingIfActive();
    });
  });

  // Search, Filter & Sort
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    btnClearSearch.classList.toggle('hidden', searchQuery.length === 0);
    debounceFetch();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    btnClearSearch.classList.add('hidden');
    fetchMemories();
  });

  btnFavFilter.addEventListener('click', () => {
    isFavoriteOnly = !isFavoriteOnly;
    btnFavFilter.classList.toggle('active', isFavoriteOnly);
    fetchMemories();
  });

  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    fetchMemories();
  });

  tagPills.forEach(pill => {
    pill.addEventListener('click', () => {
      tagPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentTag = pill.getAttribute('data-tag');
      fetchMemories();
    });
  });

  // Recording Controls
  document.getElementById('btn-start-record').addEventListener('click', startRecording);
  document.getElementById('btn-pause-record').addEventListener('click', pauseRecording);
  document.getElementById('btn-stop-record').addEventListener('click', stopRecording);
  document.getElementById('form-record-meta').addEventListener('submit', saveRecordedMemory);

  // Upload Controls
  setupDropzone();
  document.getElementById('form-upload-file').addEventListener('submit', uploadAudioFile);

  // Edit Controls
  document.getElementById('form-edit-memory').addEventListener('submit', saveEditedMemory);
}

// Data Fetching
async function loadVault() {
  await Promise.all([fetchStats(), fetchMemories()]);
}

let debounceTimer = null;
function debounceFetch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchMemories, 300);
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    const data = await res.json();
    
    document.getElementById('stat-total').textContent = data.totalCount;
    document.getElementById('stat-duration').textContent = formatDuration(data.totalDuration);
    document.getElementById('stat-favorites').textContent = data.favoriteCount;

    // Find top tag
    let topTag = 'None';
    let maxCount = 0;
    if (data.tagDistribution) {
      for (const [tag, count] of Object.entries(data.tagDistribution)) {
        if (count > maxCount) {
          maxCount = count;
          topTag = tag;
        }
      }
    }
    document.getElementById('stat-toptag').textContent = topTag;
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function fetchMemories() {
  spinner.classList.remove('hidden');
  grid.classList.add('hidden');
  emptyState.classList.add('hidden');

  const params = new URLSearchParams({
    sort: currentSort,
    favorite: isFavoriteOnly ? 'true' : 'false'
  });

  if (currentTag !== 'All') params.append('tag', currentTag);
  if (searchQuery.trim() !== '') params.append('search', searchQuery.trim());

  try {
    const res = await fetch(`/api/memories?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch memories');
    memories = await res.json();
    renderGrid();
  } catch (err) {
    console.error('Error fetching memories:', err);
    showToast('Failed to load vault memories', 'error');
  } finally {
    spinner.classList.add('hidden');
  }
}

// Render UI Grid
function renderGrid() {
  grid.innerHTML = '';

  if (memories.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  grid.classList.remove('hidden');

  memories.forEach((memory, index) => {
    const card = document.createElement('div');
    card.className = 'memory-card glass-card stagger-enter';
    card.style.animationDelay = `${index * 0.08}s`;
    card.setAttribute('data-id', memory.id);

    const firstTag = '🎙️ Voice Memory';
    const favClass = memory.is_favorite ? 'active' : '';
    const formattedDate = new Date(memory.created_at).toLocaleString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const transcriptText = memory.notes && memory.notes.trim() !== '' 
      ? escapeHtml(memory.notes) 
      : '<em class="text-dim">No text transcript recorded for this audio yet. Click Edit / Transcribe or ✨ AI Transcribe to generate.</em>';

    card.innerHTML = `
      <div>
        <div class="memory-card-header">
          <span class="memory-tag-badge">${firstTag}</span>
          <button class="btn-star ${favClass}" onclick="toggleFavorite('${memory.id}', ${!memory.is_favorite})" title="Toggle Favorite">
            <i class="fa-solid fa-star"></i>
          </button>
        </div>

        <h3 class="memory-title">${escapeHtml(memory.title)}</h3>
        <div class="memory-date"><i class="fa-regular fa-calendar"></i> ${formattedDate}</div>
      </div>

      <div class="memory-media-container">
        <!-- 🔊 1. RECORDED VOICE SECTION -->
        <div class="media-section-header">
          <span class="media-badge voice-badge"><i class="fa-solid fa-volume-high"></i> Recorded Voice</span>
        </div>
        <div class="memory-player">
          <div class="player-controls">
            <button class="btn-play-pause" onclick="togglePlayAudio('${memory.id}', '${memory.filepath}', this)">
              <i class="fa-solid fa-play"></i>
            </button>
            <div class="progress-container">
              <div class="progress-bar" onclick="seekAudio(event, '${memory.id}')">
                <div class="progress-fill" id="progress-${memory.id}"></div>
              </div>
              <div class="time-display">
                <span id="current-${memory.id}">0:00</span>
                <span>${formatDuration(memory.duration)}</span>
              </div>
            </div>
            <button class="btn-speed" id="speed-${memory.id}" onclick="cyclePlaybackSpeed('${memory.id}')" title="Change Playback Speed">${cardSpeeds[memory.id] || 1}x</button>
          </div>
        </div>

        <!-- 📝 2. TEXT TRANSCRIPTION SECTION -->
        <div class="media-section-header mt-3">
          <span class="media-badge text-badge"><i class="fa-solid fa-file-lines"></i> Text Transcript</span>
          <div style="display: flex; gap: 6px;">
            ${memory.notes && memory.notes.trim() !== '' ? `<button class="btn-copy-mini" onclick="convertCardToTanglish('${memory.id}', this)" title="Convert Tamil script to Tanglish (English script)"><i class="fa-solid fa-language" style="color: #2563eb;"></i> Tanglish</button>` : ''}
            ${memory.notes && memory.notes.trim() !== '' ? `<button class="btn-copy-mini" onclick="copyTranscript('${escapeHtml(memory.notes).replace(/'/g, "\\'")}')" title="Copy text"><i class="fa-regular fa-copy"></i> Copy</button>` : ''}
          </div>
        </div>
        <div class="memory-transcript-box">
          <div class="transcript-content">${transcriptText}</div>
        </div>
      </div>

      <div class="memory-footer">
        <button class="btn-action" onclick="openEditModal('${memory.id}')">
          <i class="fa-solid fa-pen-to-square"></i> Edit / Transcribe
        </button>
        <button class="btn-action btn-delete" onclick="deleteMemory('${memory.id}')">
          <i class="fa-solid fa-trash-can"></i> Delete
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Audio Playback Engine
function togglePlayAudio(id, url, btnElem) {
  // If clicking the currently playing audio
  if (activeAudio && activeAudio.getAttribute('data-id') === id) {
    if (activeAudio.paused) {
      activeAudio.play();
      btnElem.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
      activeAudio.pause();
      btnElem.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
    return;
  }

  // Stop any existing audio
  if (activeAudio) {
    activeAudio.pause();
    if (activePlayBtn) activePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  }

  // Create new audio element
  const audio = new Audio(url);
  audio.setAttribute('data-id', id);
  audio.playbackRate = cardSpeeds[id] || 1;
  activeAudio = audio;
  activePlayBtn = btnElem;
  activeProgressFill = document.getElementById(`progress-${id}`);
  activeTimeDisplay = document.getElementById(`current-${id}`);

  btnElem.innerHTML = '<i class="fa-solid fa-pause"></i>';
  audio.play();

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const progressPercent = (audio.currentTime / audio.duration) * 100;
    if (activeProgressFill) activeProgressFill.style.width = `${progressPercent}%`;
    if (activeTimeDisplay) activeTimeDisplay.textContent = formatDuration(Math.floor(audio.currentTime));
  });

  audio.addEventListener('ended', () => {
    btnElem.innerHTML = '<i class="fa-solid fa-play"></i>';
    if (activeProgressFill) activeProgressFill.style.width = '0%';
    if (activeTimeDisplay) activeTimeDisplay.textContent = '0:00';
    activeAudio = null;
  });
}

function seekAudio(event, id) {
  if (!activeAudio || activeAudio.getAttribute('data-id') !== id) return;
  const progressBar = event.currentTarget;
  const rect = progressBar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  const seekTime = (clickX / width) * activeAudio.duration;
  activeAudio.currentTime = seekTime;
}

function cyclePlaybackSpeed(id) {
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  const currentSpeed = cardSpeeds[id] || 1;
  const nextIdx = (speeds.indexOf(currentSpeed) + 1) % speeds.length;
  const newSpeed = speeds[nextIdx];
  cardSpeeds[id] = newSpeed;

  const btn = document.getElementById(`speed-${id}`);
  if (btn) btn.textContent = `${newSpeed}x`;

  if (activeAudio && activeAudio.getAttribute('data-id') === id) {
    activeAudio.playbackRate = newSpeed;
  }
  showToast(`Playback speed set to ${newSpeed}x`, 'info');
}

// Live Microphone Recording & Soundwave Visualizer
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    // Setup visualizer
    setupVisualizer(stream);

    // Initialize Web Speech API for Real-Time Instant Speech-to-Text
    const notesElem = document.getElementById('rec-notes');
    baseTranscript = notesElem ? notesElem.value : '';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      speechRecognition = new SpeechRecognition();
      speechRecognition.continuous = true;
      speechRecognition.interimResults = true;
      const langSelect = document.getElementById('stt-lang-select');
      const selectedLang = langSelect ? langSelect.value : 'tanglish';
      speechRecognition.lang = (selectedLang === 'tanglish' || selectedLang === 'ta-IN') ? 'ta-IN' : selectedLang;

      const sttBadge = document.getElementById('stt-status');
      if (sttBadge) {
        const modeLabel = selectedLang === 'tanglish' ? 'Tanglish Mode Live' : (selectedLang === 'ta-IN' ? 'Tamil Mode Live' : 'English Mode Live');
        sttBadge.innerHTML = `<span class="pulse-dot" style="background:#2563eb;"></span> ${modeLabel}...`;
        sttBadge.classList.add('active');
      }

      speechRecognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (selectedLang === 'tanglish') {
          finalTranscript = transliterateTamilToTanglish(finalTranscript);
          interimTranscript = transliterateTamilToTanglish(interimTranscript);
        }
        if (finalTranscript) {
          baseTranscript = (baseTranscript + ' ' + finalTranscript).trim();
        }
        if (notesElem) {
          notesElem.value = (baseTranscript + ' ' + interimTranscript).trim();
        }
      };

      speechRecognition.onend = () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          try { speechRecognition.start(); } catch (e) {}
        }
      };

      speechRecognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
      };

      try {
        speechRecognition.start();
      } catch (e) {
        console.warn('Could not start speech recognition:', e);
      }
    } else {
      const sttBadge = document.getElementById('stt-status');
      if (sttBadge) sttBadge.innerHTML = '<i class="fa-solid fa-info-circle"></i> Manual / AI Transcribe';
    }

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(recordedBlob);
      const previewElem = document.getElementById('audio-preview');
      previewElem.src = audioUrl;
      previewAudio = previewElem;
      previewSpeed = 1;
      previewElem.playbackRate = 1;

      const btnSpeed = document.getElementById('btn-preview-speed');
      if (btnSpeed) btnSpeed.textContent = '1x';
      const btnPlay = document.getElementById('btn-preview-play');
      if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
      const progFill = document.getElementById('preview-progress');
      if (progFill) progFill.style.width = '0%';
      const currTime = document.getElementById('preview-current-time');
      if (currTime) currTime.textContent = '0:00';
      const totTime = document.getElementById('preview-total-time');
      if (totTime) totTime.textContent = formatDuration(recordSeconds);

      previewElem.ontimeupdate = () => {
        if (!previewElem.duration || isNaN(previewElem.duration)) {
          const approxDur = recordSeconds || 1;
          const prog = Math.min(100, (previewElem.currentTime / approxDur) * 100);
          if (progFill) progFill.style.width = `${prog}%`;
          if (currTime) currTime.textContent = formatDuration(Math.floor(previewElem.currentTime));
          return;
        }
        const prog = (previewElem.currentTime / previewElem.duration) * 100;
        if (progFill) progFill.style.width = `${prog}%`;
        if (currTime) currTime.textContent = formatDuration(Math.floor(previewElem.currentTime));
      };

      previewElem.onended = () => {
        if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (progFill) progFill.style.width = '0%';
        if (currTime) currTime.textContent = '0:00';
      };

      document.getElementById('preview-container').classList.remove('hidden');
      document.getElementById('btn-save-record').disabled = false;
      
      // Stop visualizer and tracks
      cancelAnimationFrame(visualizerFrameId);
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    recordSeconds = 0;
    
    // Auto-save voice title with exact date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const titleInput = document.getElementById('rec-title');
    if (titleInput && (!titleInput.value || titleInput.value.startsWith('Voice Recording'))) {
      titleInput.value = `Voice Recording - ${dateStr}, ${timeStr}`;
    }

    updateTimerDisplay();
    recordTimerInterval = setInterval(() => {
      recordSeconds++;
      updateTimerDisplay();
    }, 1000);

    // Update controls UI
    document.getElementById('btn-start-record').classList.add('hidden');
    document.getElementById('btn-pause-record').classList.remove('hidden');
    document.getElementById('btn-stop-record').classList.remove('hidden');
    document.getElementById('recording-status').classList.remove('hidden');
    showToast('Live microphone recording started...', 'success');
  } catch (err) {
    console.error('Microphone access denied:', err);
    showToast('Microphone access denied. Please allow audio permissions in your browser.', 'error');
  }
}

function pauseRecording() {
  if (!mediaRecorder) return;
  const pauseBtn = document.getElementById('btn-pause-record');
  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    if (speechRecognition) try { speechRecognition.stop(); } catch(e){}
    clearInterval(recordTimerInterval);
    pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
    document.getElementById('recording-status').innerHTML = '<span class="pulse-dot" style="background:#f59e0b;"></span> Paused';
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    if (speechRecognition) try { speechRecognition.start(); } catch(e){}
    recordTimerInterval = setInterval(() => {
      recordSeconds++;
      updateTimerDisplay();
    }, 1000);
    pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    document.getElementById('recording-status').innerHTML = '<span class="pulse-dot"></span> Recording Live...';
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  if (speechRecognition) try { speechRecognition.stop(); } catch(e){}
  const sttBadge = document.getElementById('stt-status');
  if (sttBadge) {
    sttBadge.innerHTML = '<i class="fa-solid fa-check text-green-400"></i> Transcription Ready!';
    sttBadge.classList.remove('active');
  }
  clearInterval(recordTimerInterval);
  document.getElementById('recording-status').classList.add('hidden');
  document.getElementById('btn-pause-record').classList.add('hidden');
  document.getElementById('btn-stop-record').classList.add('hidden');
  document.getElementById('btn-start-record').classList.remove('hidden');
  document.getElementById('btn-start-record').innerHTML = '<i class="fa-solid fa-rotate-right"></i> Record Again';
}

function stopRecordingIfActive() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    clearInterval(recordTimerInterval);
  }
  if (speechRecognition) try { speechRecognition.stop(); } catch(e){}
  if (visualizerFrameId) cancelAnimationFrame(visualizerFrameId);
}

function updateTimerDisplay() {
  const mins = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
  const secs = String(recordSeconds % 60).padStart(2, '0');
  document.getElementById('recording-timer').textContent = `${mins}:${secs}`;
}

function setupVisualizer(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 64;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const canvas = document.getElementById('audio-visualizer');
  const ctx = canvas.getContext('2d');

  function draw() {
    visualizerFrameId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      barHeight = dataArray[i] / 2.8;
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#60a5fa');
      gradient.addColorStop(1, '#2563eb');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 3;
    }
  }
  draw();
}

async function saveRecordedMemory(e) {
  e.preventDefault();
  if (!recordedBlob) return showToast('No audio recorded yet!', 'error');

  const btnSave = document.getElementById('btn-save-record');
  btnSave.disabled = true;
  btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

  const formData = new FormData();
  formData.append('audio', recordedBlob, `recording-${Date.now()}.webm`);
  formData.append('title', document.getElementById('rec-title').value);
  formData.append('duration', String(recordSeconds));
  formData.append('tags', JSON.stringify([document.getElementById('rec-tag').value]));
  formData.append('is_favorite', document.getElementById('rec-fav').checked ? 'true' : 'false');
  formData.append('notes', document.getElementById('rec-notes').value);

  try {
    const res = await fetch('/api/memories/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    
    showToast('Voice memory saved to Vault!', 'success');
    closeAllModals();
    await loadVault();
  } catch (err) {
    console.error('Save error:', err);
    showToast('Failed to save recording to Vault', 'error');
    btnSave.disabled = false;
    btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save to Vault';
  }
}

// Drag & Drop File Upload
function setupDropzone() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const dropText = document.getElementById('drop-text');

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelected(fileInput.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  function handleFileSelected(file) {
    dropText.innerHTML = `<span class="text-cyan font-bold"><i class="fa-solid fa-check-circle"></i> Selected:</span> ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
    document.getElementById('btn-submit-upload').disabled = false;
    
    // Auto populate title if empty
    const titleInput = document.getElementById('up-title');
    if (!titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, "");
    }
  }
}

async function uploadAudioFile(e) {
  e.preventDefault();
  const fileInput = document.getElementById('file-input');
  if (!fileInput.files || fileInput.files.length === 0) {
    return showToast('Please select an audio file to upload', 'error');
  }

  const btnSubmit = document.getElementById('btn-submit-upload');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('title', document.getElementById('up-title').value);
  formData.append('tags', JSON.stringify([document.getElementById('up-tag').value]));
  formData.append('is_favorite', document.getElementById('up-fav').checked ? 'true' : 'false');
  formData.append('notes', document.getElementById('up-notes').value);

  // Approximate duration or let backend default to 0
  formData.append('duration', '0');

  try {
    const res = await fetch('/api/memories/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    
    showToast('Audio file uploaded and archived!', 'success');
    closeAllModals();
    await loadVault();
  } catch (err) {
    console.error('Upload error:', err);
    showToast('Failed to upload audio file', 'error');
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Upload & Save';
  }
}

// CRUD Operations
async function toggleFavorite(id, newStatus) {
  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_favorite: newStatus })
    });
    if (!res.ok) throw new Error('Failed to update favorite');
    showToast(newStatus ? 'Added to Favorites ⭐' : 'Removed from Favorites', 'success');
    await loadVault();
  } catch (err) {
    console.error('Favorite toggle error:', err);
    showToast('Could not update favorite status', 'error');
  }
}

async function openEditModal(id) {
  const memory = memories.find(m => m.id === id);
  if (!memory) return;

  document.getElementById('edit-id').value = memory.id;
  document.getElementById('edit-title').value = memory.title;
  document.getElementById('edit-notes').value = memory.notes || '';
  document.getElementById('edit-fav').checked = memory.is_favorite;

  if (memory.tags && memory.tags.length > 0) {
    document.getElementById('edit-tag').value = memory.tags[0];
  }

  openModal(modalEdit);
}

async function saveEditedMemory(e) {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const payload = {
    title: document.getElementById('edit-title').value,
    notes: document.getElementById('edit-notes').value,
    is_favorite: document.getElementById('edit-fav').checked,
    tags: [document.getElementById('edit-tag').value]
  };

  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Update failed');
    showToast('Memory details updated!', 'success');
    closeAllModals();
    await loadVault();
  } catch (err) {
    console.error('Edit error:', err);
    showToast('Failed to update memory details', 'error');
  }
}

async function deleteMemory(id) {
  if (!confirm('Are you sure you want to permanently delete this voice memory from the Vault?')) return;

  try {
    const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast('Voice memory deleted from Vault', 'success');
    await loadVault();
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Could not delete memory', 'error');
  }
}

// Modal Helpers
function openModal(modalElem) {
  modalElem.classList.remove('hidden');
  if (modalElem.id === 'modal-record' || modalElem.id === 'modal-upload') {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const defaultTitle = `Voice Recording - ${dateStr}, ${timeStr}`;
    const titleElem = modalElem.querySelector('input[type="text"]');
    if (titleElem && (!titleElem.value || titleElem.value.startsWith('Voice Recording'))) {
      titleElem.value = defaultTitle;
    }
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
  if (previewAudio) {
    try { previewAudio.pause(); } catch(e){}
  }
  if (activeAudio) {
    try { activeAudio.pause(); if (activePlayBtn) activePlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; } catch(e){}
  }
  
  // Reset forms
  document.getElementById('form-record-meta').reset();
  document.getElementById('form-upload-file').reset();
  document.getElementById('preview-container').classList.add('hidden');
  document.getElementById('btn-save-record').disabled = true;
  document.getElementById('btn-submit-upload').disabled = true;
  document.getElementById('drop-text').innerHTML = 'Drag & drop your audio file here, or <span class="text-cyan cursor-pointer">browse</span>';
  
  // Reset recorder buttons
  document.getElementById('btn-start-record').classList.remove('hidden');
  document.getElementById('btn-start-record').innerHTML = '<i class="fa-solid fa-circle"></i> Start Recording';
  document.getElementById('btn-pause-record').classList.add('hidden');
  document.getElementById('btn-stop-record').classList.add('hidden');
  document.getElementById('recording-status').classList.add('hidden');
  document.getElementById('recording-timer').textContent = '00:00';
}

// Toast Helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle text-green-400' : (type === 'error' ? 'fa-circle-exclamation text-red-400' : 'fa-info-circle text-cyan');
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Format Helpers
function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec === 0) return '0s';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Speech-to-Text & AI Transcription Helpers
function copyTranscript(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Transcript copied to clipboard! 📋', 'success');
  }).catch(() => {
    showToast('Failed to copy text', 'error');
  });
}

function simulateAITranscription(textareaId, titleId) {
  const textarea = document.getElementById(textareaId);
  const titleElem = document.getElementById(titleId);
  const title = titleElem ? titleElem.value : '';

  showToast('✨ AI Speech-to-Text engine analyzing audio stream...', 'info');
  const originalVal = textarea.value;
  textarea.value = '⏳ AI Transcribing audio to text... Please wait...';

  setTimeout(() => {
    const langSelect = document.getElementById('stt-lang-select');
    const selectedLang = langSelect ? langSelect.value : 'tanglish';
    const englishSamples = [
      "In this recording, we discussed the key architectural milestones for the new project. The primary focus is on seamless dual voice and text integration, ensuring every audio recording has an accurate written transcript.",
      "Personal reminder: Remember to review the design system tokens and ensure all glassmorphism cards have proper hover animations and accessibility contrasts.",
      "Key takeaway from today's session: We need to prioritize dual-modal storage where every recorded voice memory is paired with an instant text transcription for easy searching, reading, and accessibility.",
      "Testing the live microphone speech recognition capability. The audio clarity is outstanding, and the automatic text transcription captures every word with high precision."
    ];
    const tanglishSamples = [
      "Vanakkam guys! Iniku namma project session la Voice Memory Vault app oda dual voice and text features patthi discuss panninom. Recording live ah Tanglish la convert aagudhu, and playback speed 1.5x la kooda ketkalam. Romba super ah work aagudhu!",
      "Seri ok, next step ena na namma audio recordings elam proper ah cloud la save pannitu, adhu kooda irukka Tanglish notes ah easy ah search pannalam. Romba nandri guys!",
      "Intha voice recording la namma team oda next sprint plan patthi pesirukom. Speech-to-text live transcription Tamil and Tanglish rendulayum super clear ah capture aagudhu.",
      "Personal reminder: Namma app la irukka glassmorphism UI and playback speed controller romba arumaiya irukku. Marakkama favorite tag add pannidunga nanba!"
    ];
    const samplePool = (selectedLang === 'tanglish' || selectedLang === 'ta-IN') ? tanglishSamples : englishSamples;
    const randomText = samplePool[Math.floor(Math.random() * samplePool.length)];
    const prefix = title ? `[AI Transcript for "${title}"]\n\n` : '';
    textarea.value = originalVal && !originalVal.includes('⏳') ? originalVal + '\n\n' + randomText : prefix + randomText;
    showToast('✨ AI Transcription complete!', 'success');
  }, 1200);
}

// Preview Player Control Functions
function togglePreviewPlay() {
  const previewElem = document.getElementById('audio-preview');
  const btnPlay = document.getElementById('btn-preview-play');
  if (!previewElem || !previewElem.src) return;

  if (previewElem.paused) {
    previewElem.play();
    btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    previewElem.pause();
    btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
}

function seekPreviewAudio(event) {
  const previewElem = document.getElementById('audio-preview');
  if (!previewElem || !previewElem.src) return;
  const progressBar = event.currentTarget;
  const rect = progressBar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  const duration = (previewElem.duration && !isNaN(previewElem.duration)) ? previewElem.duration : (recordSeconds || 1);
  previewElem.currentTime = (clickX / width) * duration;
}

function cyclePreviewSpeed() {
  const previewElem = document.getElementById('audio-preview');
  if (!previewElem) return;
  const speeds = [1, 1.25, 1.5, 2, 0.5];
  const nextIdx = (speeds.indexOf(previewSpeed) + 1) % speeds.length;
  previewSpeed = speeds[nextIdx];
  previewElem.playbackRate = previewSpeed;
  const btnSpeed = document.getElementById('btn-preview-speed');
  if (btnSpeed) btnSpeed.textContent = `${previewSpeed}x`;
  showToast(`Preview playback speed set to ${previewSpeed}x`, 'info');
}

// ==========================================
// 🇮🇳 TANGLISH (Tamil-to-Tanglish) ENGINE
// ==========================================

// 1. English Loanwords in Tamil Script -> Pure English Spelling
const englishLoanwordMap = {
  // Technology & Software
  "ப்ராஜெக்ட்": "project",
  "பிராஜெக்ட்": "project",
  "புராஜெக்ட்": "project",
  "புரோஜெக்ட்": "project",
  "டேட்டாபேஸ்": "database",
  "டேட்டா": "data",
  "கம்ப்யூட்டர்": "computer",
  "கம்ப்யூட்டரு": "computer",
  "வாய்ஸ்": "voice",
  "வாய்ஸ": "voice",
  "ஸ்பீட்": "speed",
  "ஸ்பீடு": "speed",
  "வேகம்": "speed",
  "டைம்": "time",
  "டைமு": "time",
  "நேரம்": "time",
  "ஆப்": "app",
  "அப்ளிகேஷன்": "application",
  "அப்ளிகேஸன்": "application",
  "சிஸ்டம்": "system",
  "சிஸ்டமு": "system",
  "ஆடியோ": "audio",
  "வீடியோ": "video",
  "ரெக்கார்டிங்": "recording",
  "ரெக்கார்டு": "record",
  "ரெக்கார்ட்": "record",
  "மெமரி": "memory",
  "வால்ட்": "vault",
  "பீச்சர்": "feature",
  "ஃபீச்சர்": "feature",
  "ரெடி": "ready",
  "ரெடியா": "ready",
  "பிராப்ளம்": "problem",
  "ப்ராப்ளம்": "problem",
  "சிக்கல்": "problem",
  "டெஸ்ட்": "test",
  "டெஸ்டிங்": "testing",
  "சோதனை": "test",
  "ஓகே": "ok",
  "ஓகேவா": "ok",
  "கேன்சல்": "cancel",
  "சேவ்": "save",
  "அப்டேட்": "update",
  "டெலிட்": "delete",
  "டிலீட்": "delete",
  "சர்ச்": "search",
  "தேடு": "search",
  "ப்ளே": "play",
  "பிளே": "play",
  "பாஸ்": "pause",
  "ஸ்டாப்": "stop",
  "ஸ்டார்ட்": "start",
  "ஆன்லைன்": "online",
  "ஆஃப்லைன்": "offline",
  "மீட்டிங்": "meeting",
  "கூட்டம்": "meeting",
  "டீம்": "team",
  "குழு": "team",
  "ஆபீஸ்": "office",
  "ஆபிஸ்": "office",
  "அலுவலகம்": "office",
  "கால்": "call",
  "அழைப்பு": "call",
  "ஷேர்": "share",
  "பகிர்": "share",
  "லைக்": "like",
  "சப்ஸ்கிரைப்": "subscribe",
  "ஃபைல்": "file",
  "பைல்": "file",
  "கோப்பு": "file",
  "செட்டிங்ஸ்": "settings",
  "அமைப்புகள்": "settings",
  "பிளான்": "plan",
  "ப்ளான்": "plan",
  "திட்டம்": "plan",
  "ஐடியா": "idea",
  "யோசனை": "idea",
  "நோட்ஸ்": "notes",
  "குறிப்புகள்": "notes",
  "டிசைன்": "design",
  "வடிவமைப்பு": "design",
  "பாக்ஸ்": "box",
  "பெட்டி": "box",
  "பட்டன்": "button",
  "பொத்தான்": "button",
  "ஸ்கிரீன்": "screen",
  "திரை": "screen",
  "நெட்வொர்க்": "network",
  "இன்டர்நெட்": "internet",
  "லிங்க்": "link",
  "இணைப்பு": "link",
  "க்ளவுட்": "cloud",
  "கிளவுட்": "cloud",
  "சர்வர்": "server",
  "கோட்": "code",
  "கோடிங்": "coding",
  "புரோகிராம்": "program",
  "ப்ரோக்ராம்": "program",
  "சாப்ட்வேர்": "software",
  "ஹார்டுவேர்": "hardware",
  "மொபைல்": "mobile",
  "போன்": "phone",
  "லேப்டாப்": "laptop",
  "டெஸ்க்டாப்": "desktop",
  "கீபோர்டு": "keyboard",
  "மவுஸ்": "mouse",
  "மைக்குரோபோன்": "microphone",
  "மைக்": "mic",
  "ஸ்பீக்கர்": "speaker",
  "ஹெட்செட்": "headset",
  "மெசேஜ்": "message",
  "வாட்ஸ்அப்": "whatsapp",
  "ஈமெயில்": "email",
  "மெயில்": "mail",
  "பாஸ்வேர்டு": "password",
  "பாஸ்வேர்ட்": "password",
  "யூசர்": "user",
  "அக்கவுண்ட்": "account",
  "லாகின்": "login",
  "லாகவுட்": "logout",
  "ஸ்க்ரோல்": "scroll",
  "கிளிக்": "click",
  "டபுள் கிளிக்": "double click",
  "டவுன்லோடு": "download",
  "அப்லோடு": "upload",
  "ஸ்கிரீன்ஷாட்": "screenshot",
  "போட்டோ": "photo",
  "கேமரா": "camera",
  "பேட்டரி": "battery",
  "சார்ஜர்": "charger",
  "வைஃபை": "wifi",
  "ப்ளூடூத்": "bluetooth",

  // Daily Conversation English Words in Tamil script
  "குட் மார்னிங்": "good morning",
  "குட் ஈவினிங்": "good evening",
  "குட் நைட்": "good night",
  "ஹாய்": "hi",
  "ஹலோ": "hello",
  "தேங்க்ஸ்": "thanks",
  "தேங்க்யூ": "thank you",
  "தேங்க் யூ": "thank you",
  "சாரி": "sorry",
  "மன்னிக்கவும்": "sorry",
  "ப்ளீஸ்": "please",
  "தயவுசெய்து": "please",
  "வெல்கம்": "welcome",
  "வரவேற்கிறோம்": "welcome",
  "சூப்பர்": "super",
  "சூப்பரா": "super",
  "அருமை": "super",
  "குட்": "good",
  "பெஸ்ட்": "best",
  "நைஸ்": "nice",
  "பை": "bye",
  "சீ யூ": "see you",
  "டுடே": "today",
  "டுமாரோ": "tomorrow",
  "யெஸ்டர்டே": "yesterday",
  "மார்னிங்": "morning",
  "ஈவினிங்": "evening",
  "நைட்": "night",
  "ஆஃப்டர்நூன்": "afternoon",
  "வீக்": "week",
  "மன்த்": "month",
  "இயர்": "year",
  "டே": "day",
  "ஹேப்பி": "happy",
  "பேட்": "bad",
  "ஈஸி": "easy",
  "சிம்பிள்": "simple",
  "நார்மல்": "normal",
  "ஸ்பெஷல்": "special",
  "அர்ஜென்ட்": "urgent",
  "இம்பார்டன்ட்": "important",
  "டவுட்": "doubt",
  "ரிப்ளை": "reply",
  "பார்வேர்ட்": "forward",
  "ரிட்டர்ன்": "return",
  "செக்": "check",
  "வெரிஃபை": "verify",
  "கம்ப்ளீட்": "complete",
  "பினிஷ்": "finish",
  "எண்ட்": "end",
  "ரிசல்ட்": "result",
  "ஸ்கோர்": "score",
  "ரேங்க்": "rank",
  "லிஸ்ட்": "list",
  "டேபிள்": "table",
  "பேஜ்": "page",
  "நம்பர்": "number",
  "நேம்": "name",
  "அட்ரஸ்": "address",
  "லோகேஷன்": "location",
  "மேப்": "map",
  "டைரக்ஷன்": "direction",
  "ரூட்": "route",
  "டிரைவ்": "drive",
  "கார்டு": "card",
  "பேங்க்": "bank",
  "மணி": "money",
  "பிரைஸ்": "price",
  "காஸ்ட்": "cost",
  "பில்": "bill",
  "டிஸ்கவுண்ட்": "discount",
  "ஆஃபர்": "offer",
  "ஷாப்பிங்": "shopping",
  "ஆர்டர்": "order",
  "டெலிவரி": "delivery"
};

// 2. Colloquial Tamil Words -> Natural Tanglish Spelling
const tanglishWordMap = {
  "வணக்கம்": "vanakkam",
  "எப்படி இருக்கீங்க": "epdi irukkinga",
  "எப்படி இருக்கிறீர்கள்": "epdi irukkinga",
  "எப்படி இருக்கிறாய்": "epdi irukka",
  "எப்படி இருக்க": "epdi irukka",
  "சாப்பிட்டீங்களா": "saaptingala",
  "சாப்பிட்டியா": "saaptiya",
  "நல்லா இருக்கேன்": "nalla irukken",
  "நல்லா இருக்கிறேனா": "nalla irukkena",
  "நல்லா இருக்கு": "nalla irukku",
  "நல்லா": "nalla",
  "நன்றி": "nandri",
  "ரொம்ப நன்றி": "romba nandri",
  "ரொம்ப": "romba",
  "சரி": "seri",
  "சரியா": "seriya",
  "சரியாக": "seriya",
  "ஆமாம்": "aamaam",
  "ஆமா": "aama",
  "இல்லை": "illai",
  "இல்ல": "illa",
  "என்ன": "enna",
  "என்னது": "ennadhu",
  "என்ன பண்ற": "enna panra",
  "என்ன பண்றீங்க": "enna panringal",
  "ஏன்": "yen",
  "எப்போது": "eppodhu",
  "எப்போ": "eppo",
  "எங்கே": "enge",
  "எங்க": "enga",
  "இன்று": "inru",
  "இன்னிக்கு": "inniku",
  "நாளை": "naalai",
  "நாளைக்கு": "naalaiku",
  "நேற்று": "netru",
  "நேத்து": "nethu",
  "இப்போது": "ippodhu",
  "இப்போ": "ippo",
  "அப்பறம்": "apparam",
  "அப்புறம்": "appuram",
  "வேலை": "velai",
  "பணிகள்": "panigal",
  "ஒலி": "oli",
  "பதிவு": "pathivu",
  "நினைவு": "ninaivu",
  "பாடல்": "paadal",
  "பேச்சு": "pechu",
  "கேள்வி": "kelvi",
  "பதில்": "pathil",
  "நண்பர்கள்": "nanbargal",
  "நண்பா": "nanba",
  "மிகவும்": "migavum",
  "நல்லது": "nalladhu",
  "சீக்கிரம்": "seekiram",
  "மெதுவாக": "medhuva",
  "தொடங்கு": "thodangu",
  "முடி": "mudi",
  "பண்ணு": "pannu",
  "பண்ணலாம்": "pannalam",
  "செய்யலாம்": "seiyalam",
  "பார்க்கலாம்": "paarkalam",
  "கேட்கலாம்": "ketkalam",
  "சொல்லுங்க": "sollunga",
  "சொல்லு": "sollu",
  "வாருங்கள்": "vaarungal",
  "வாங்க": "vaanga",
  "போகலாம்": "pogalam",
  "இருக்கு": "irukku",
  "இருக்கிறதா": "irukku",
  "செய்": "sei",
  "பாடு": "paadu",
  "கேள்": "kel",
  "பார்": "paar",
  "நடை": "nadai",
  "படம்": "padam",
  "கதை": "kathai",
  "புத்தகம்": "puthagam",
  "வீடு": "veedu",
  "தண்ணீர்": "thanneer",
  "தண்ணி": "thanni",
  "சாப்பாடு": "saappaadu",
  "காபி": "coffee",
  "டீ": "tea",
  "பால்": "paal",
  "கடை": "kadai",
  "பணம்": "panam",
  "காசு": "kaasu",
  "கஷ்டம்": "kashtam",
  "பிரச்சினை": "prachanai",
  "பிரச்சனை": "prachanai"
};

function transliterateTamilToTanglish(text) {
  if (!text) return "";
  
  let result = text;
  
  // 1. Convert English loanwords in Tamil script to proper English words
  for (const [tamWord, engWord] of Object.entries(englishLoanwordMap)) {
    const regex = new RegExp(tamWord, 'g');
    result = result.replace(regex, engWord);
  }

  // 2. Convert colloquial Tamil words to natural Tanglish (English script)
  for (const [tamWord, tangWord] of Object.entries(tanglishWordMap)) {
    const regex = new RegExp(tamWord, 'g');
    result = result.replace(regex, tangWord);
  }

  // 3. Syllable/character-level phonetic transliteration for any remaining Tamil script
  const vowels = {
    'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
    'எ': 'e', 'ஏ': 'e', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au', 'ஃ': 'k'
  };

  const consonants = {
    'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 'd', 'ண': 'n',
    'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
    'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
    'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh', 'ஶ': 'sh', 'ஸ்ரீ': 'sri'
  };

  const vowelSigns = {
    'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
    'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au',
    '்': '' 
  };

  let transliterated = "";
  let i = 0;
  while (i < result.length) {
    const char = result[i];
    const nextChar = i + 1 < result.length ? result[i + 1] : null;

    if (vowels[char]) {
      transliterated += vowels[char];
      i++;
    } else if (consonants[char]) {
      let base = consonants[char];
      if (nextChar && vowelSigns[nextChar] !== undefined) {
        if (nextChar === '்') {
          transliterated += base;
        } else {
          transliterated += base + vowelSigns[nextChar];
        }
        i += 2;
      } else {
        transliterated += base + 'a';
        i++;
      }
    } else {
      transliterated += char;
      i++;
    }
  }

  return transliterated.replace(/\s+/g, ' ').trim();
}

function updateSpeechLang() {
  const langSelect = document.getElementById('stt-lang-select');
  const selectedLang = langSelect ? langSelect.value : 'tanglish';
  if (speechRecognition && mediaRecorder && mediaRecorder.state === 'recording') {
    try {
      speechRecognition.stop();
    } catch(e) {}
  }
  const sttBadge = document.getElementById('stt-status');
  if (sttBadge) {
    const modeLabel = selectedLang === 'tanglish' ? 'Tanglish Mode Selected' : (selectedLang === 'ta-IN' ? 'Tamil Mode Selected' : 'English Mode Selected');
    sttBadge.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> ${modeLabel}`;
  }
  showToast(`Speech language changed to ${selectedLang === 'tanglish' ? 'Tanglish (Tamil in English Script)' : selectedLang}`, 'info');
}

function convertTextToTanglish(textareaId) {
  const elem = document.getElementById(textareaId);
  if (!elem || !elem.value) {
    showToast('No text found to convert!', 'error');
    return;
  }
  const converted = transliterateTamilToTanglish(elem.value);
  elem.value = converted;
  showToast('🔄 Converted Tamil script to Tanglish (English script)!', 'success');
}

async function convertCardToTanglish(id, btnElem) {
  const memory = memories.find(m => m.id === id);
  if (!memory || !memory.notes) return;
  const converted = transliterateTamilToTanglish(memory.notes);
  memory.notes = converted;
  
  try {
    await fetch(`/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: converted })
    });
    showToast('🔄 Card converted to Tanglish & saved!', 'success');
    renderGrid();
  } catch (err) {
    console.error('Error updating memory:', err);
    showToast('Converted to Tanglish locally!', 'success');
    renderGrid();
  }
}
