import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { auth, microsoftProvider } from './firebase';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import FolderView from './pages/FolderView';
import AllPhotosView from './pages/AllPhotosView';
import UploadCenterView from './pages/UploadCenterView';
import AiGeneratorView from './pages/AiGeneratorView';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
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

  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading AVMA Hub...</div>;

  if (!user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-color)' }}>
        <div className="glass" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
          <img src="/avmais-logo.png" alt="AVMA Insurance Services Logo" style={{ maxHeight: '60px', maxWidth: '100%', objectFit: 'contain', margin: '0 auto 2rem', display: 'block' }} />
          <h2 style={{ marginBottom: '1rem' }}>Photo Studio</h2>
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
    <BrowserRouter>
      <Routes>
        <Route element={<DashboardLayout user={user} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}>
          <Route path="/" element={<DashboardHome searchQuery={searchQuery} />} />
          <Route path="/folders" element={<FolderView searchQuery={searchQuery} />} />
          <Route path="/folders/:folderId" element={<FolderView searchQuery={searchQuery} />} />
          <Route path="/all-photos" element={<AllPhotosView searchQuery={searchQuery} />} />
          <Route path="/upload" element={<UploadCenterView />} />
          <Route path="/generate" element={<AiGeneratorView />} />
          <Route path="/trash" element={<FolderView searchQuery={searchQuery} />} />
          <Route path="/settings" element={<div style={{ padding: '2rem' }}>Settings coming soon...</div>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
