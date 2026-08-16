import { Search, X, Star } from 'lucide-react';

export default function ControlsBar({ 
  searchQuery, setSearchQuery, 
  currentTag, setCurrentTag, 
  isFavoriteOnly, setIsFavoriteOnly, 
  currentSort, setCurrentSort 
}) {
  const tags = ['All', '🎙️ Voice Memory']; // Could be dynamic in future

  return (
    <>
      <section className="controls-bar glass-card">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            placeholder="Search memories by title, lyrics, or notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
