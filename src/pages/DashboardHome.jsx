import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, onSnapshot, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Folder, FileImage, UploadCloud, Sparkles, Clock, ArrowRight, HardDrive, Tag, ImagePlus } from 'lucide-react';
import UploadManager from '../components/UploadManager';

export default function DashboardHome({ searchQuery }) {
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [aiUsage, setAiUsage] = useState({ used: 0, limit: 100 });

  // Fetch AI Usage for the current month
  useEffect(() => {
    const fetchUsage = async () => {
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      try {
        const docRef = doc(db, 'ai_usage', currentMonthKey);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAiUsage({ used: docSnap.data().count || 0, limit: 100 });
        }
      } catch (err) {
        console.error("Failed to fetch AI usage:", err);
      }
    };
    fetchUsage();
  }, []);

  // Fetch all active folders for metrics
  useEffect(() => {
    const q = query(collection(db, 'folders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(f => f.status !== 'deleted');
      setFolders(list);
    });
    return unsubscribe;
  }, []);

  // Fetch all active photos for live metrics calculation
  useEffect(() => {
    const q = query(collection(db, 'photos'), limit(300));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.status !== 'deleted');
      setPhotos(list);
    });
    return unsubscribe;
  }, []);

  // Computed metrics
  const totalPhotosCount = photos.length;

  const totalStorageFormatted = useMemo(() => {
    const totalBytes = photos.reduce((acc, p) => acc + (p.size || 0), 0);
    if (totalBytes === 0) return '0 MB';
    if (totalBytes > 1024 * 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [photos]);

  const totalTagsCount = useMemo(() => {
    return photos.reduce((acc, p) => acc + (p.tags ? p.tags.length : 0), 0);
  }, [photos]);

  const recentPhotos = useMemo(() => {
    return photos.slice(0, 12);
  }, [photos]);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* High-Contrast Welcome Banner */}
      <div 
        className="glass" 
        style={{ 
          padding: '2.25rem', 
          borderRadius: '16px', 
          marginBottom: '2.5rem', 
          background: 'linear-gradient(135deg, #002244 0%, #00305E 50%, #004B91 100%)', 
          color: '#FFFFFF',
          boxShadow: '0 8px 32px rgba(0, 48, 94, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', background: 'rgba(85, 184, 0, 0.2)', color: '#76E01A', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', border: '1px solid rgba(118, 224, 26, 0.4)' }}>
              <Sparkles size={16} /> Enterprise Asset Hub
            </div>
            <h2 style={{ fontSize: '1.85rem', margin: 0, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              AVMA Photo Studio Dashboard
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#E0F2FE', fontSize: '0.95rem', maxWidth: '650px', lineHeight: '1.5' }}>
              Centralized DAM platform with automated Google Gemini AI image indexing, HEIC conversion, and secure cloud storage.
            </p>
          </div>
        </div>
      </div>

      {/* Cool Live Metric Cards / Bubbles Section */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-dark)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--primary)" /> Workspace Analytics & Storage Metrics
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {/* Bubble 1: Total Photos */}
          <div 
            className="glass" 
            style={{ 
              padding: '1.5rem', 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, rgba(0, 139, 149, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%)',
              border: '1px solid rgba(0, 139, 149, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#E0F7FA', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#008B95' }}>
              <FileImage size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Photos
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)', margin: '2px 0' }}>
                {totalPhotosCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#008B95', fontWeight: 600 }}>
                Active DAM Assets
              </div>
            </div>
          </div>

          {/* Bubble 2: Storage Used */}
          <div 
            className="glass" 
            style={{ 
              padding: '1.5rem', 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, rgba(0, 48, 94, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%)',
              border: '1px solid rgba(0, 48, 94, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00305E' }}>
              <HardDrive size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Storage Used
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)', margin: '2px 0' }}>
                {totalStorageFormatted}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#00305E', fontWeight: 600 }}>
                Firebase Cloud Storage
              </div>
            </div>
          </div>

          {/* Bubble 3: AI Tags Created */}
          <div 
            className="glass" 
            style={{ 
              padding: '1.5rem', 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, rgba(85, 184, 0, 0.1) 0%, rgba(255, 255, 255, 0.9) 100%)',
              border: '1px solid rgba(85, 184, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#55B800' }}>
              <Tag size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                AI Tags Created
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)', margin: '2px 0' }}>
                {totalTagsCount}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#3B8216', fontWeight: 600 }}>
                Gemini 2.5 Flash Vision
              </div>
            </div>
          </div>

          {/* Bubble 4: Folders Organized */}
          <div 
            className="glass" 
            style={{ 
              padding: '1.5rem', 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, rgba(0, 75, 145, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%)',
              border: '1px solid rgba(0, 75, 145, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              cursor: 'pointer'
            }}
            onClick={() => navigate('/folders')}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#E8F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#004B91' }}>
              <Folder size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Active Folders
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)', margin: '2px 0' }}>
                {folders.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#004B91', fontWeight: 600 }}>
                Click to Manage Folders →
              </div>
            </div>
          </div>

          {/* Bubble 5: AI Images Generated */}
          <div 
            className="glass" 
            style={{ 
              padding: '1.5rem', 
              borderRadius: '16px', 
              background: 'linear-gradient(135deg, rgba(142, 36, 170, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%)',
              border: '1px solid rgba(142, 36, 170, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#F3E5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8E24AA' }}>
              <ImagePlus size={26} />
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                AI Generations
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-dark)', margin: '2px 0' }}>
                {aiUsage.used} / {aiUsage.limit}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#8E24AA', fontWeight: 600 }}>
                {aiUsage.limit - aiUsage.used} Remaining This Month
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Recent Uploads Stream */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.2rem', color: 'var(--text-dark)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} color="var(--primary)" /> Recent Photos
          </h3>
          <Link to="/all-photos" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            Explore All Photos <ArrowRight size={16} />
          </Link>
        </div>

        {recentPhotos.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No recent photos found.</p>
        ) : (
          <div className="photo-grid">
            {recentPhotos.map(photo => (
              <div 
                key={photo.id} 
                className="photo-card"
                onClick={() => navigate(`/all-photos?photo=${photo.id}`)}
                style={{ cursor: 'pointer' }}
              >
                {photo.originalUrl ? (
                  <img src={photo.originalUrl} alt={photo.filename} loading="lazy" decoding="async" />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <FileImage size={32} />
                  </div>
                )}

                {photo.tags && photo.tags.length > 0 && (
                  <div className="photo-overlay">
                    {photo.tags.slice(0, 3).map(t => (
                      <span key={t} className="tag-badge">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
