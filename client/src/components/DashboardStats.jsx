import { Layers, Clock, Star, Tag } from 'lucide-react';

function formatDuration(totalSeconds) {
  if (!totalSeconds) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function DashboardStats({ stats }) {
  // Calculate top tag
  let topTag = 'None';
  let maxCount = 0;
  if (stats.tagDistribution) {
    for (const [tag, count] of Object.entries(stats.tagDistribution)) {
      if (count > maxCount) {
        maxCount = count;
        topTag = tag;
      }
    }
  }

  return (
    <section className="stats-grid">
      <div className="stat-card glass-card">
        <div className="stat-icon cyan"><Layers size={24} /></div>
        <div className="stat-info">
          <span className="stat-label">Total Memories</span>
          <h3 className="stat-value">{stats.totalCount || 0}</h3>
        </div>
      </div>
      
      <div className="stat-card glass-card">
        <div className="stat-icon violet"><Clock size={24} /></div>
        <div className="stat-info">
          <span className="stat-label">Total Duration</span>
          <h3 className="stat-value">{formatDuration(stats.totalDuration)}</h3>
        </div>
      </div>
      
      <div className="stat-card glass-card">
        <div className="stat-icon golden"><Star size={24} /></div>
        <div className="stat-info">
          <span className="stat-label">Favorite Vault Items</span>
          <h3 className="stat-value">{stats.favoriteCount || 0}</h3>
        </div>
      </div>

      <div className="stat-card glass-card">
        <div className="stat-icon pink"><Tag size={24} /></div>
        <div className="stat-info">
          <span className="stat-label">Top Category</span>
          <h3 className="stat-value" style={{fontSize: topTag.length > 15 ? '16px' : '24px'}}>{topTag}</h3>
        </div>
      </div>
    </section>
  );
}
