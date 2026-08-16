import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';

localforage.config({
  name: 'VoiceMemoryVault',
  storeName: 'memories'
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
  const id = uuidv4();
  const filename = `${id}.webm`;
  
  if (audioBlob) {
    const base64Data = await blobToBase64(audioBlob);
    await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Data
    });
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
  const memories = (await localforage.getItem('memories')) || [];
  return memories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

export const getMemoryAudioUrl = async (filename) => {
  try {
    if (Capacitor.isNativePlatform()) {
      const { uri } = await Filesystem.getUri({
        path: filename,
        directory: Directory.Data
      });
      return Capacitor.convertFileSrc(uri);
    } else {
      const { data } = await Filesystem.readFile({
        path: filename,
        directory: Directory.Data
      });
      // Web fallback: convert base64 back to Blob URL
      const response = await fetch(`data:audio/webm;base64,${data}`);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.error('Failed to get audio url:', e);
    return null;
  }
};

export const updateMemory = async (id, updates) => {
  const memories = (await localforage.getItem('memories')) || [];
  const index = memories.findIndex(m => m.id === id);
  if (index > -1) {
    memories[index] = { ...memories[index], ...updates };
    await localforage.setItem('memories', memories);
    return memories[index];
  }
  throw new Error("Memory not found");
};

export const deleteMemory = async (id) => {
  const memories = (await localforage.getItem('memories')) || [];
  const index = memories.findIndex(m => m.id === id);
  if (index > -1) {
    const filename = memories[index].filename;
    memories.splice(index, 1);
    await localforage.setItem('memories', memories);
    
    try {
      await Filesystem.deleteFile({
        path: filename,
        directory: Directory.Data
      });
    } catch (e) {
      console.warn("Could not delete file:", e);
    }
  }
};

export const getStats = async () => {
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
