import { NavLink } from 'react-router-dom';
import { Home, Image as ImageIcon, Folder, Upload, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div style={{ padding: '0 12px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: 'var(--primary)', color: 'white', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          AV
        </div>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Photo Hub</h2>
      </div>

      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', padding: '0 12px' }}>
          Library
        </div>
        
        <NavLink to="/" className={({isActive}) => `sidebar-nav-link ${isActive ? 'active' : ''}`} end>
          <Home size={18} /> Home
        </NavLink>
        <NavLink to="/all-photos" className={({isActive}) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <ImageIcon size={18} /> All Photos
        </NavLink>
        <NavLink to="/folders" className={({isActive}) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <Folder size={18} /> Folders
        </NavLink>
        <NavLink to="/upload" className={({isActive}) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <Upload size={18} /> Upload Center
        </NavLink>

      </nav>

      <div style={{ marginTop: 'auto' }}>
        <NavLink to="/settings" className={({isActive}) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <Settings size={18} /> Settings
        </NavLink>
      </div>
    </aside>
  );
}
