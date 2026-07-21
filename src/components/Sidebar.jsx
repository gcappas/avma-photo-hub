import { NavLink } from 'react-router-dom';
import { Home, Image as ImageIcon, Folder, Upload, Settings, Trash2 } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div style={{ padding: '0 12px', marginBottom: '2.5rem', display: 'flex', alignItems: 'center' }}>
        <img src="/avmais-logo.png" alt="AVMA Insurance Services Logo" style={{ maxHeight: '44px', maxWidth: '100%', objectFit: 'contain' }} />
      </div>

      <nav style={{ flex: 1 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', padding: '0 12px' }}>
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
        <NavLink to="/trash" className={({isActive}) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
          <Trash2 size={18} /> Trash Bin
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
