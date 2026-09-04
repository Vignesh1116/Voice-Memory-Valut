import { Link, useLocation } from 'react-router-dom';
import { UploadCloud, Mic } from 'lucide-react';

export default function Navbar({ onOpenRecord, onOpenUpload }) {
  const location = useLocation();

  return (
    <header className="navbar glass-card">
      <div className="brand">
        <div className="brand-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: '#ffffff'}}>
            <path d="M12 2v20"/>
            <path d="M17 5v14"/>
            <path d="M22 10v4"/>
            <path d="M7 5v14"/>
            <path d="M2 10v4"/>
          </svg>
        </div>
        <div className="brand-text">
          <h1>Voice <span>Vault</span></h1>
          <p>Preserve your thoughts and ideas</p>
        </div>
      </div>
      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onOpenUpload}>
          <UploadCloud size={18} /> Upload File
        </button>
        <button className="btn btn-primary" onClick={onOpenRecord}>
          <Mic size={18} /> Record Memory
        </button>
      </div>

      {/* Floating Action Button for Mobile */}
      <button className="btn-fab-record" onClick={onOpenRecord} title="Record Voice Memory">
        <Mic size={24} />
      </button>
    </header>
  );
}
