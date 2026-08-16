import { Settings as SettingsIcon, HardDrive, Bell, Shield } from 'lucide-react';

export default function Settings() {
  return (
    <div className="settings-page">
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
        <SettingsIcon size={28} style={{color: 'var(--primary)'}} />
        <h2 style={{fontSize: '24px', fontFamily: 'var(--font-heading)', color: 'var(--text-main)'}}>Application Settings</h2>
      </div>

      <div className="memories-grid">
        <div className="glass-card" style={{padding: '24px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <HardDrive size={20} style={{color: 'var(--text-muted)'}} />
            <h3 style={{fontSize: '16px', color: 'var(--text-main)'}}>Storage Preferences</h3>
          </div>
          <p style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px'}}>
            Voice Vault automatically stores your audio files locally.
          </p>
          <div className="form-group">
            <label>Local Storage Path</label>
            <input type="text" value="./uploads/audio" disabled />
          </div>
        </div>

        <div className="glass-card" style={{padding: '24px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <Shield size={20} style={{color: 'var(--text-muted)'}} />
            <h3 style={{fontSize: '16px', color: 'var(--text-main)'}}>Privacy & AI</h3>
          </div>
          <p style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px'}}>
            Control how transcription services process your voice.
          </p>
          <label className="fav-checkbox-label" style={{display: 'flex', marginBottom: '12px'}}>
            <input type="checkbox" checked={true} readOnly />
            <span className="star-toggle" style={{background: '#eff6ff', color: 'var(--primary)', borderColor: '#bfdbfe'}}>Process audio locally</span>
          </label>
        </div>

        <div className="glass-card" style={{padding: '24px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
            <Bell size={20} style={{color: 'var(--text-muted)'}} />
            <h3 style={{fontSize: '16px', color: 'var(--text-main)'}}>Notifications</h3>
          </div>
          <p style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px'}}>
            Manage toast notifications and alerts.
          </p>
          <div style={{display: 'flex', gap: '12px'}}>
            <button className="btn btn-primary">Enable Alerts</button>
            <button className="btn btn-secondary">Mute</button>
          </div>
        </div>
      </div>
    </div>
  );
}
