import DashboardStats from '../components/DashboardStats';
import ControlsBar from '../components/ControlsBar';
import MemoryGrid from '../components/MemoryGrid';

export default function Dashboard({
  stats,
  searchQuery, setSearchQuery,
  currentTag, setCurrentTag,
  isFavoriteOnly, setIsFavoriteOnly,
  currentSort, setCurrentSort,
  loading,
  memories,
  activeAudioId, setActiveAudioId,
  setActiveModal, setEditingMemory,
  fetchVaultData
}) {
  return (
    <>
      <DashboardStats stats={stats} />
      
      <ControlsBar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        currentTag={currentTag}
        setCurrentTag={setCurrentTag}
        isFavoriteOnly={isFavoriteOnly}
        setIsFavoriteOnly={setIsFavoriteOnly}
        currentSort={currentSort}
        setCurrentSort={setCurrentSort}
      />
      
      <main className="memories-container">
        {loading ? (
          <div className="spinner-box">
            <div className="spinner"></div>
            <p>Loading Vault Memories...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color: '#94a3b8'}}>
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            </div>
            <h2>Your Voice Vault is Empty</h2>
            <p>Start preserving your ideas and stories today.</p>
            <button className="btn btn-primary mt-4" onClick={() => setActiveModal('record')}>
              Record Your First Memory
            </button>
          </div>
        ) : (
          <MemoryGrid 
            memories={memories} 
            onEdit={(mem) => { setEditingMemory(mem); setActiveModal('edit'); }}
            refreshData={fetchVaultData}
            activeAudioId={activeAudioId}
            setActiveAudioId={setActiveAudioId}
          />
        )}
      </main>
    </>
  );
}
