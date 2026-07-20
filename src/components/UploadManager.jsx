import { useState, useCallback } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { UploadCloud, FileImage, X } from 'lucide-react';

export default function UploadManager() {
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
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
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
    // Create a storage reference
    const storageRef = ref(storage, `photos/${Date.now()}_${uploadItem.file.name}`);
    
    // Start upload
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
        // Upload completed
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        
        // Save to firestore with initial 'processing' state.
        // The Cloud Function will pick this up, run AI, and update the document.
        try {
          await addDoc(collection(db, 'photos'), {
            filename: uploadItem.file.name,
            originalUrl: downloadURL,
            storagePath: uploadTask.snapshot.ref.fullPath,
            size: uploadItem.file.size,
            contentType: uploadItem.file.type,
            uploadedAt: serverTimestamp(),
            status: 'processing_ai' // Cloud function will change this to 'ready' and add tags
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
        className={`glass ${isDragging ? 'dragging' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          padding: '3rem',
          textAlign: 'center',
          border: isDragging ? '2px dashed var(--primary)' : '2px dashed var(--border)',
          backgroundColor: isDragging ? 'rgba(0, 119, 182, 0.05)' : 'var(--surface)',
          transition: 'all 0.3s ease',
          cursor: 'pointer'
        }}
        onClick={() => document.getElementById('fileUpload').click()}
      >
        <UploadCloud size={48} color={isDragging ? 'var(--primary)' : 'var(--text-muted)'} style={{ marginBottom: '1rem' }} />
        <h3>Drop High-Res Photos Here</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>or click to browse from your computer (mass upload supported)</p>
        <input 
          type="file" 
          id="fileUpload" 
          multiple 
          accept="image/*" 
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
          <h4 style={{ marginBottom: '1rem' }}>Upload Queue</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {uploads.map(u => (
              <div key={u.id} className="glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <FileImage size={24} color="var(--primary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 500 }}>{u.file.name}</span>
                    <span style={{ color: u.status === 'error' ? 'red' : 'var(--text-muted)' }}>
                      {u.status === 'completed' ? 'Done' : u.status === 'error' ? 'Failed' : `${Math.round(u.progress)}%`}
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
