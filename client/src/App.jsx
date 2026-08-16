import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Modals from './components/Modals';
import { getMemories, getStats } from './services/localDb';

// Pages
import Dashboard from './pages/Dashboard';

function App() {
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState({ totalCount: 0, totalDuration: 0, favoriteCount: 0, tagDistribution: {} });
  const [loading, setLoading] = useState(true);
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTag, setCurrentTag] = useState('All');
  const [isFavoriteOnly, setIsFavoriteOnly] = useState(false);
  const [currentSort, setCurrentSort] = useState('newest');

  // Modals
  const [activeModal, setActiveModal] = useState(null); // 'record', 'upload', 'edit', null
  const [editingMemory, setEditingMemory] = useState(null);

  // Audio Playback State (Single source of truth)
  const [activeAudioId, setActiveAudioId] = useState(null);

  const fetchVaultData = async () => {
    setLoading(true);
    try {
      const statsData = await getStats();
      setStats(statsData);

      let memData = await getMemories();

      // Apply Search Filter
      if (searchQuery.trim() !== '') {
        const term = searchQuery.trim().toLowerCase();
        memData = memData.filter(m => 
          (m.title && m.title.toLowerCase().includes(term)) ||
          (m.description && m.description.toLowerCase().includes(term)) ||
          (m.notes && m.notes.toLowerCase().includes(term))
        );
      }

      // Apply Favorite Filter
      if (isFavoriteOnly) {
        memData = memData.filter(m => m.is_favorite);
      }

      // Apply Tag Filter
      if (currentTag !== 'All') {
        memData = memData.filter(m => (m.tags || []).includes(currentTag));
      }

      // Apply Sort
      if (currentSort === 'oldest') {
        memData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      } else if (currentSort === 'longest') {
        memData.sort((a, b) => parseInt(b.duration || 0) - parseInt(a.duration || 0));
      } else if (currentSort === 'shortest') {
        memData.sort((a, b) => parseInt(a.duration || 0) - parseInt(b.duration || 0));
      } else {
        // default newest
        memData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }

      setMemories(memData);
    } catch (err) {
      console.error('Error fetching vault data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVaultData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentTag, isFavoriteOnly, currentSort]);

  return (
    <>
      <div className="app-container">
        <Navbar 
          onOpenRecord={() => setActiveModal('record')}
          onOpenUpload={() => setActiveModal('upload')}
        />
        
        <Routes>
          <Route path="/" element={
            <Dashboard 
              stats={stats}
              searchQuery={searchQuery} setSearchQuery={setSearchQuery}
              currentTag={currentTag} setCurrentTag={setCurrentTag}
              isFavoriteOnly={isFavoriteOnly} setIsFavoriteOnly={setIsFavoriteOnly}
              currentSort={currentSort} setCurrentSort={setCurrentSort}
              loading={loading}
              memories={memories}
              activeAudioId={activeAudioId} setActiveAudioId={setActiveAudioId}
              setActiveModal={setActiveModal}
              setEditingMemory={setEditingMemory}
              fetchVaultData={fetchVaultData}
            />
          } />
        </Routes>

      </div>

      {activeModal && (
        <Modals 
          activeModal={activeModal}
          closeModal={() => { setActiveModal(null); setEditingMemory(null); }}
          refreshData={fetchVaultData}
          editingMemory={editingMemory}
        />
      )}
    </>
  );
}

export default App;
