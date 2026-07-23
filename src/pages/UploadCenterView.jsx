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
      {/* Header Banner */}
      <div className="glass" style={{ padding: '2rem', borderRadius: '16px', marginBottom: '2.5rem', background: 'linear-gradient(135deg, #00305E 0%, #008B95 100%)', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#55B800', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          <Sparkles size={18} /> High Performance Media Ingestion
        </div>
        <h2 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 700 }}>Dedicated Upload Center</h2>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.95rem' }}>
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
