import MemoryCard from './MemoryCard';

export default function MemoryGrid({ memories, onEdit, refreshData, activeAudioId, setActiveAudioId }) {
  return (
    <div className="memories-grid">
      {memories.map((memory, index) => (
        <MemoryCard 
          key={memory.id} 
          memory={memory} 
          index={index} 
          onEdit={onEdit} 
          refreshData={refreshData}
          activeAudioId={activeAudioId}
          setActiveAudioId={setActiveAudioId}
        />
      ))}
    </div>
  );
}
