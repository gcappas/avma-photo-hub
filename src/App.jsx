import { useState, useEffect } from 'react';
import { signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, microsoftProvider } from './firebase';
import UploadManager from './components/UploadManager';
import PhotoGallery from './components/PhotoGallery';
import './index.css';
import { LogOut, UploadCloud } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged is the recommended way to get the current user in Firebase
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, microsoftProvider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Check console for details.");
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '20vh' }}>Loading AVMA Hub...</div>;

  if (!user) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <div className="glass" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <div style={{ background: 'var(--primary)', color: 'white', width: '80px', height: '80px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem', fontWeight: 'bold' }}>
            AV
          </div>
          <h2>AVMA Photo Hub</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
            Marketing assets and high-res photos. Sign in with your corporate account to continue.
          </p>
          <button className="btn" onClick={handleLogin} style={{ width: '100%', justifyContent: 'center' }}>
            Sign In with Microsoft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="glass" style={{ position: 'sticky', top: '1rem', zIndex: 100, margin: '1rem auto', maxWidth: '1200px', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--primary)', color: 'white', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            AV
          </div>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>AVMA Photo Hub</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{user.displayName || user.email}</span>
          <button onClick={handleLogout} className="btn" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--text-dark)', padding: '8px 12px' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="container">
        <UploadManager />
        <PhotoGallery />
      </main>
    </div>
  );
}

export default App;
