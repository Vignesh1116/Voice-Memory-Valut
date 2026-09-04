import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

localforage.config({
  name: 'VoiceMemoryVault',
  storeName: 'memories'
});

const audioStore = localforage.createInstance({
  name: 'VoiceMemoryVault',
  storeName: 'audio_blobs'
});

// Helper to convert Blob to base64
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
};

export const saveMemory = async (memoryData, audioBlob) => {
  // 1. Try saving to Express Server API first
  try {
    const formData = new FormData();
    if (audioBlob) {
      const mime = audioBlob.type || 'audio/webm';
      let ext = 'webm';
      if (mime.includes('mp4')) ext = 'mp4';
      else if (mime.includes('wav')) ext = 'wav';
      else if (mime.includes('ogg')) ext = 'ogg';
      else if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3';

      formData.append('audio', audioBlob, `recording-${Date.now()}.${ext}`);
    }
    formData.append('title', memoryData.title || '');
    formData.append('duration', String(memoryData.duration || '0'));
    formData.append('tags', JSON.stringify(memoryData.tags || ['🎙️ Voice Memory']));
    formData.append('is_favorite', memoryData.is_favorite ? 'true' : 'false');
    formData.append('notes', memoryData.notes || '');

    const response = await fetch('/api/memories/upload', {
      method: 'POST',
      body: formData
    });

    if (response.ok) {
      const savedMemory = await response.json();
      return savedMemory;
    }
  } catch (apiErr) {
    console.warn('API save failed, using local storage fallback:', apiErr);
  }

  // 2. Fallback for offline / client-only mode
  const id = uuidv4();
  const filename = `${id}.webm`;
  
  if (audioBlob) {
    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = await blobToBase64(audioBlob);
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Data
        });
      } catch (fsErr) {
        console.error('Capacitor Filesystem write error:', fsErr);
        await audioStore.setItem(filename, audioBlob);
      }
    } else {
      await audioStore.setItem(filename, audioBlob);
    }
  }

  const memory = {
    ...memoryData,
    id,
    filename,
    filepath: filename,
    created_at: new Date().toISOString()
  };

  const currentMemories = (await localforage.getItem('memories')) || [];
  currentMemories.push(memory);
  await localforage.setItem('memories', currentMemories);
  return memory;
};

export const getMemories = async () => {
  try {
    const res = await fetch('/api/memories');
    if (res.ok) {
      const serverMemories = await res.json();
      return serverMemories;
    }
  } catch (apiErr) {
    console.warn('API fetch failed, falling back to localforage:', apiErr);
  }

  const memories = (await localforage.getItem('memories')) || [];
  return memories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const getMemoryAudioUrl = async (filepathOrFilename) => {
  if (!filepathOrFilename) return null;

  // If path starts with / or http, it's a server URL
  if (filepathOrFilename.startsWith('/') || filepathOrFilename.startsWith('http')) {
    return filepathOrFilename;
  }

  try {
    if (Capacitor.isNativePlatform()) {
      try {
        const { uri } = await Filesystem.getUri({
          path: filepathOrFilename,
          directory: Directory.Data
        });
        return Capacitor.convertFileSrc(uri);
      } catch (e) {
        console.warn('Filesystem.getUri failed, checking audioStore:', e);
      }
    }

    const blob = await audioStore.getItem(filepathOrFilename);
    if (blob) {
      return URL.createObjectURL(blob);
    }

    try {
      const { data } = await Filesystem.readFile({
        path: filepathOrFilename,
        directory: Directory.Data
      });
      const response = await fetch(`data:audio/webm;base64,${data}`);
      const b = await response.blob();
      return URL.createObjectURL(b);
    } catch (e) {
      // ignore
    }
  } catch (e) {
    console.error('Failed to get audio url:', e);
  }

  return null;
};

export const updateMemory = async (id, updates) => {
  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (apiErr) {
    console.warn('API update failed, using localforage:', apiErr);
  }

  const memories = (await localforage.getItem('memories')) || [];
  const index = memories.findIndex(m => m.id === id);
  if (index > -1) {
    memories[index] = { ...memories[index], ...updates };
    await localforage.setItem('memories', memories);
    return memories[index];
  }
  throw new Error('Memory not found');
};

export const deleteMemory = async (id) => {
  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      return;
    }
  } catch (apiErr) {
    console.warn('API delete failed, using localforage:', apiErr);
  }

  const memories = (await localforage.getItem('memories')) || [];
  const index = memories.findIndex(m => m.id === id);
  if (index > -1) {
    const filename = memories[index].filename;
    memories.splice(index, 1);
    await localforage.setItem('memories', memories);
    
    if (filename) {
      await audioStore.removeItem(filename).catch(() => {});
      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.deleteFile({
            path: filename,
            directory: Directory.Data
          });
        } catch (e) {
          console.warn('Could not delete native file:', e);
        }
      }
    }
  }
};

export const getStats = async () => {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      return await res.json();
    }
  } catch (apiErr) {
    console.warn('API stats failed, using local calculation:', apiErr);
  }

  const memories = await getMemories();
  const totalCount = memories.length;
  const favoriteCount = memories.filter(m => m.is_favorite).length;
  const totalDuration = memories.reduce((acc, m) => acc + (parseInt(m.duration) || 0), 0);
  
  const tagDistribution = {};
  memories.forEach(m => {
    (m.tags || []).forEach(t => {
      tagDistribution[t] = (tagDistribution[t] || 0) + 1;
    });
  });

  return {
    totalCount,
    totalDuration,
    favoriteCount,
    tagDistribution
  };
};

