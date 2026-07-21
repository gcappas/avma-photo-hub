import { Search, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Header({ user, searchQuery, setSearchQuery }) {
  const handleLogout = () => signOut(auth);

  return (
    <header className="header">
      <div className="search-container">
        <Search className="search-icon" size={18} />
        <input 
          type="search" 
          placeholder="Search by AI tags, description, or filename..." 
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary-hover)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.9rem' }}>
            {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user?.displayName || 'User'}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</span>
          </div>
        </div>
        
        <button onClick={handleLogout} className="btn-secondary" style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', border: '1px solid var(--border)', background: 'white' }}>
          <LogOut size={14} /> <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Log out</span>
        </button>
      </div>
    </header>
  );
}
