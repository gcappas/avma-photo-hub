import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UploadCloud, Folder, FolderPlus, CheckCircle2, Sparkles, Image as ImageIcon } from 'lucide-react';
import UploadManager from '../components/UploadManager';

export default function UploadCenterView() {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');

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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* High-Contrast Header Banner */}
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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', background: 'rgba(85, 184, 0, 0.2)', color: '#76E01A', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', border: '1px solid rgba(118, 224, 26, 0.4)' }}>
          <Sparkles size={16} /> High Performance Media Ingestion
        </div>
        <h2 style={{ fontSize: '1.85rem', margin: 0, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
          Dedicated Upload Center
        </h2>
        <p style={{ margin: '0.5rem 0 0 0', color: '#E0F2FE', fontSize: '0.95rem', maxWidth: '650px', lineHeight: '1.5' }}>
          Upload high-resolution camera originals, HEIC photos, and asset batches directly to your organization folders.
        </p>
      </div>

      {/* Main Upload Dropzone Area */}
      <div className="glass" style={{ padding: '2.5rem', borderRadius: '16px', background: 'white' }}>
        <h3 style={{ fontSize: '1.25rem', color: 'var(--text-dark)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={22} color="var(--primary)" /> Drag & Drop Upload Station
        </h3>

        <UploadManager />
      </div>

      {/* Helpful Guidelines */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '2.5rem' }}>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
            <CheckCircle2 size={18} /> Automatic Folder Enforcement
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
            All uploads require selecting or creating a target folder so files stay organized across your team.
          </p>
        </div>

        <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.5rem' }}>
            <Sparkles size={18} /> Automatic HEIC & AI Tagging
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5' }}>
            Apple HEIC files convert automatically to web-ready JPEG, and Google Gemini AI extracts descriptions & tags.
          </p>
        </div>
      </div>
    </div>
  );
}
