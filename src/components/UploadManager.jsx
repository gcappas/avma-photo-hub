import { useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { UploadCloud, FileImage, X } from 'lucide-react';

export default function UploadManager({ targetFolderId }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState([]); // { file, progress, status, id }

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files) => {
    const imageFiles = files.filter(f => 
      f.type.startsWith('image/') || 
      f.name.toLowerCase().endsWith('.heic') || 
      f.name.toLowerCase().endsWith('.heif')
    );
    
    const newUploads = imageFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading'
    }));

    setUploads(prev => [...newUploads, ...prev]);

    newUploads.forEach(upload => {
      uploadFile(upload);
    });
  };

  const uploadFile = (uploadItem) => {
    const storageRef = ref(storage, `photos/${Date.now()}_${uploadItem.file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, uploadItem.file);

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploads(prev => prev.map(u => 
          u.id === uploadItem.id ? { ...u, progress } : u
        ));
      }, 
      (error) => {
        console.error("Upload failed", error);
        setUploads(prev => prev.map(u => 
          u.id === uploadItem.id ? { ...u, status: 'error' } : u
        ));
      }, 
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        try {
          await addDoc(collection(db, 'photos'), {
            filename: uploadItem.file.name,
            originalUrl: downloadURL,
            storagePath: uploadTask.snapshot.ref.fullPath,
            size: uploadItem.file.size,
            contentType: uploadItem.file.type || (uploadItem.file.name.toLowerCase().endsWith('.heic') ? 'image/heic' : 'image/jpeg'),
            uploadedAt: serverTimestamp(),
            folderId: targetFolderId || null,
            status: 'processing_ai'
          });

          setUploads(prev => prev.map(u => 
            u.id === uploadItem.id ? { ...u, status: 'completed', progress: 100 } : u
          ));
        } catch (err) {
          console.error("Error writing document", err);
          setUploads(prev => prev.map(u => 
            u.id === uploadItem.id ? { ...u, status: 'error' } : u
          ));
        }
      }
    );
  };

  return (
    <div style={{ marginBottom: '3rem' }}>
      <div 
        className={`drop-zone ${isDragging ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('fileUpload').click()}
      >
        <UploadCloud size={48} color={isDragging ? 'var(--primary)' : 'var(--text-muted)'} style={{ marginBottom: '1rem' }} />
        <h3>Drop High-Res Photos Here</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>or click to browse from your computer (mass upload supported)</p>
        <input 
          type="file" 
          id="fileUpload" 
          multiple 
          accept="image/*,.heic,.heif" 
          onChange={handleFileInput} 
          style={{ display: 'none' }} 
        />
        <button className="btn" onClick={(e) => { e.stopPropagation(); document.getElementById('fileUpload').click(); }}>
          Select Files
        </button>
      </div>

      {/* Upload Progress List */}
      {uploads.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0 }}>Upload Queue</h4>
            <button 
              className="btn-secondary" 
              style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setUploads([])}
            >
              <X size={14} /> Clear Queue
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {uploads.map(u => (
              <div key={u.id} className="glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <FileImage size={24} color="var(--primary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 500 }}>{u.file.name}</span>
                    <span style={{ color: u.status === 'error' ? 'red' : 'var(--text-muted)' }}>
                      {u.status === 'completed' ? 'Done' : u.status === 'error' ? 'Failed' : u.status === 'converting' ? 'Converting HEIC...' : `${Math.round(u.progress)}%`}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${u.progress}%`, 
                      height: '100%', 
                      background: u.status === 'error' ? 'red' : 'var(--primary)',
                      transition: 'width 0.2s ease'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
