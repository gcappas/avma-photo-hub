import { useState, useCallback, useEffect } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, onSnapshot } from 'firebase/firestore';
import { storage, db } from '../firebase';
import { UploadCloud, FileImage, X, Folder, FolderPlus } from 'lucide-react';

export default function UploadManager({ targetFolderId }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState([]); // { file, progress, status, id }
  
  // Folder selector modal states
  const [pendingFiles, setPendingFiles] = useState([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(targetFolderId || '');
  const [newFolderName, setNewFolderName] = useState('');

  // Fetch active folders
  useEffect(() => {
    if (!showFolderModal) return;

    const q = query(collection(db, 'folders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const folderList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(f => f.status !== 'deleted');
      setFolders(folderList);
    });

    return unsubscribe;
  }, [showFolderModal]);

  // Keep selectedFolderId in sync if targetFolderId changes
  useEffect(() => {
    if (targetFolderId) {
      setSelectedFolderId(targetFolderId);
    }
  }, [targetFolderId]);

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
    
    if (imageFiles.length === 0) return;

    // Save pending files and open folder picker modal
    setPendingFiles(imageFiles);
    setNewFolderName('');
    setShowFolderModal(true);
  };

  const executeUpload = (folderId) => {
    const newUploads = pendingFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading'
    }));

    setUploads(prev => [...newUploads, ...prev]);
    setShowFolderModal(false);
    setPendingFiles([]);

    newUploads.forEach(upload => {
      uploadFile(upload, folderId);
    });
  };

  const handleCreateAndUpload = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      // Create new folder in Firestore
      const folderRef = await addDoc(collection(db, 'folders'), {
        name: newFolderName.trim(),
        parentId: targetFolderId || null,
        createdAt: serverTimestamp()
      });
      executeUpload(folderRef.id);
    } catch (err) {
      console.error("Error creating folder for upload:", err);
      alert("Failed to create folder.");
    }
  };

  const uploadFile = (uploadItem, folderId) => {
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
            folderId: folderId || null,
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

      {/* Choose/Create Folder Modal */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => { setShowFolderModal(false); setPendingFiles([]); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>Choose Upload Target Folder</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              All photos must be uploaded into a folder. Please pick an existing folder or create a new one.
            </p>

            {/* Create New Folder option */}
            <form onSubmit={handleCreateAndUpload} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
              <input 
                type="text" 
                placeholder="Create new folder & upload..." 
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
              />
              <button 
                type="submit" 
                className="btn" 
                disabled={!newFolderName.trim()}
                style={{ background: !newFolderName.trim() ? 'var(--text-muted)' : 'var(--accent)', cursor: !newFolderName.trim() ? 'not-allowed' : 'pointer' }}
              >
                <FolderPlus size={16} /> Create
              </button>
            </form>

            {/* Existing Folders Selection */}
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Select Existing Folder</h4>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1.5rem' }}>
              {folders.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem', textAlign: 'center' }}>No folders found. Create one above to start!</p>
              ) : (
                folders.map(folder => (
                  <div 
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    style={{ 
                      padding: '10px', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '10px',
                      background: selectedFolderId === folder.id ? '#E8F0FE' : 'transparent',
                      color: selectedFolderId === folder.id ? 'var(--primary)' : 'inherit',
                      fontWeight: selectedFolderId === folder.id ? 600 : 'normal'
                    }}
                  >
                    <Folder size={18} color={selectedFolderId === folder.id ? 'var(--primary)' : 'var(--text-muted)'} fill={selectedFolderId === folder.id ? 'rgba(0, 97, 254, 0.1)' : 'none'} />
                    {folder.name}
                  </div>
                ))
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  setShowFolderModal(false);
                  setPendingFiles([]);
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn" 
                onClick={() => executeUpload(selectedFolderId)}
                disabled={!selectedFolderId}
                style={{ 
                  background: !selectedFolderId ? 'var(--text-muted)' : 'var(--accent)', 
                  borderColor: !selectedFolderId ? 'var(--text-muted)' : 'var(--accent)',
                  cursor: !selectedFolderId ? 'not-allowed' : 'pointer'
                }}
              >
                Confirm & Upload
              </button>
            </div>
          </div>
        </div>
      )}

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
