import { useRef, useEffect } from 'react';
import { Search, X, Star } from 'lucide-react';

export default function ControlsBar({ 
  searchQuery, setSearchQuery, 
  currentTag, setCurrentTag, 
  isFavoriteOnly, setIsFavoriteOnly, 
  currentSort, setCurrentSort 
}) {
  const inputRef = useRef(null);
  const tags = ['All', '🎙️ Voice Memory'];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <section className="controls-bar glass-card">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Search memories by title, text, or notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {!searchQuery && (
            <span className="search-kbd-hint">⌘K</span>
          )}
          {searchQuery && (
            <button className="btn-clear" onClick={() => setSearchQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>

        <div className="filter-sort-group">
          <button 
            className={`btn btn-toggle ${isFavoriteOnly ? 'active' : ''}`}
            onClick={() => setIsFavoriteOnly(!isFavoriteOnly)}
            title="Show favorites only"
          >
            <Star size={16} fill={isFavoriteOnly ? "currentColor" : "none"} /> Favorites Only
          </button>

          <div className="sort-box">
            <label htmlFor="sort-select">Sort:</label>
            <select 
              id="sort-select" 
              className="glass-select"
              value={currentSort}
              onChange={(e) => setCurrentSort(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="longest">Longest Duration</option>
              <option value="shortest">Shortest Duration</option>
            </select>
          </div>
        </div>
      </section>

      <section className="category-pills">
        {tags.map(tag => (
          <button 
            key={tag}
            className={`pill ${currentTag === tag ? 'active' : ''}`}
            onClick={() => setCurrentTag(tag)}
          >
            {tag === 'All' ? 'All Memories' : tag}
          </button>
        ))}
      </section>
    </>
  );
}
