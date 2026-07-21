import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, deleteObject } from 'firebase/storage';
import { Folder, FileImage, Plus, ChevronRight, X, Trash2 } from 'lucide-react';
import UploadManager from '../components/UploadManager';

export default function FolderView({ searchQuery }) {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAllPhotos = location.pathname.startsWith('/all-photos');
  const isUploadView = location.pathname.startsWith('/upload');
  
  const [folders, setFolders] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);

  // Fetch current folder details & build breadcrumbs
  useEffect(() => {
    if (isAllPhotos) {
      setCurrentFolder({ id: 'all', name: 'All Photos' });
      setBreadcrumbs([{ id: 'all', name: 'All Photos' }]);
      return;
    }
    if (isUploadView) {
      setCurrentFolder({ id: 'upload', name: 'Upload Center' });
      setBreadcrumbs([{ id: 'upload', name: 'Upload Center' }]);
      return;
    }

    if (!folderId) {
      setCurrentFolder({ id: 'root', name: 'Home' });
      setBreadcrumbs([{ id: 'root', name: 'Home' }]);
      return;
    }

    const fetchFolderData = async () => {
      const folderRef = doc(db, 'folders', folderId);
      const folderSnap = await getDoc(folderRef);
      if (folderSnap.exists()) {
        const data = folderSnap.data();
        setCurrentFolder({ id: folderSnap.id, ...data });
        
        // Build breadcrumbs recursively (simplified for this demo: just Home > Current)
        setBreadcrumbs([
          { id: 'root', name: 'Home' },
          { id: folderSnap.id, name: data.name }
        ]);
      } else {
        navigate('/'); // invalid folder
      }
    };
    
    fetchFolderData();
  }, [folderId, navigate, isAllPhotos, isUploadView]);

  // Fetch subfolders
  useEffect(() => {
    if (isAllPhotos || isUploadView) return;
    const parentId = folderId || null;
    const q = query(collection(db, 'folders'), where('parentId', '==', parentId));
    
    console.log("Subscribing to folders query with parentId:", parentId);
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const folderList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log("Fetched folders:", folderList.length);
        setFolders(folderList);
      },
      (error) => {
        console.error("Firestore folders snapshot failed:", error);
      }
    );

    return unsubscribe;
  }, [folderId, isAllPhotos, isUploadView]);

  // Fetch photos
  useEffect(() => {
    if (isUploadView) return;
    
    const q = query(collection(db, 'photos'));
    console.log("Subscribing to all photos");
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const photoList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log("Fetched photos count:", photoList.length);
        setPhotos(photoList);
      },
      (error) => {
        console.error("Firestore photos snapshot failed:", error);
      }
    );

    return unsubscribe;
  }, [isUploadView]);

  // Client-side search and folder filtering
  const filteredPhotos = photos.filter(photo => {
    // 1. Folder Filtering
    if (!isAllPhotos) {
      const parentId = folderId || null;
      const photoFolderId = photo.folderId || null;
      if (photoFolderId !== parentId) return false;
    }

    // 2. Search Filtering
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const tagsMatch = photo.tags?.some(tag => tag.toLowerCase().includes(q));
    const descMatch = photo.description?.toLowerCase().includes(q);
    const nameMatch = photo.storagePath?.toLowerCase().includes(q);
    return tagsMatch || descMatch || nameMatch;
  });

  const filteredFolders = folders.filter(f => {
    if (!searchQuery) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    const folderName = newFolderName;
    setNewFolderName('');
    setShowCreateModal(false);
    
    try {
      await addDoc(collection(db, 'folders'), {
        name: folderName,
        parentId: folderId || null,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder. See console.");
    }
  };

  const handleDeleteFolder = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm("Are you sure you want to delete this folder? Subfolders and photos inside it will not be deleted but will be moved to the root/orphaned.")) return;
    
    try {
      await deleteDoc(doc(db, 'folders', id));
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Failed to delete folder.");
    }
  };

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm("Are you sure you want to delete this photo?")) return;

    try {
      // 1. Delete document from Firestore
      await deleteDoc(doc(db, 'photos', photo.id));

      // 2. Delete file from Cloud Storage if storagePath exists
      if (photo.storagePath) {
        const storageRef = ref(storage, photo.storagePath);
        await deleteObject(storageRef).catch((err) => {
          console.warn("Storage deletion failed or file not found:", err);
        });
      }
      
      setSelectedPhoto(null);
    } catch (error) {
      console.error("Error deleting photo:", error);
      alert("Failed to delete photo. It will be removed from the UI anyway.");
      try {
        await deleteDoc(doc(db, 'photos', photo.id));
        setSelectedPhoto(null);
      } catch (err) {}
    }
  };

  const handlePhotoClick = (photo) => {
    if (isSelectMode) {
      if (selectedPhotoIds.includes(photo.id)) {
        setSelectedPhotoIds(selectedPhotoIds.filter(id => id !== photo.id));
      } else {
        setSelectedPhotoIds([...selectedPhotoIds, photo.id]);
      }
    } else {
      setSelectedPhoto(photo);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotoIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete the ${selectedPhotoIds.length} selected photos?`)) return;
    
    const idsToDelete = [...selectedPhotoIds];
    const photosToDelete = photos.filter(p => idsToDelete.includes(p.id));
    
    // Clear selection state early
    setIsSelectMode(false);
    setSelectedPhotoIds([]);
    
    if (selectedPhoto && idsToDelete.includes(selectedPhoto.id)) {
      setSelectedPhoto(null);
    }

    for (const photo of photosToDelete) {
      try {
        // 1. Delete from Firestore
        await deleteDoc(doc(db, 'photos', photo.id));
        
        // 2. Delete from Storage
        if (photo.storagePath) {
          const storageRef = ref(storage, photo.storagePath);
          await deleteObject(storageRef).catch((err) => {
            console.warn("Storage deletion failed:", err);
          });
        }
      } catch (error) {
        console.error(`Error deleting photo ${photo.id}:`, error);
        try {
          await deleteDoc(doc(db, 'photos', photo.id));
        } catch (err) {}
      }
    }
  };

  const handleAddTag = async (photo, e) => {
    e.preventDefault();
    const input = e.target.elements.newTag;
    const tag = input.value.trim().toLowerCase();
    
    if (!tag) return;
    
    if (photo.tags && photo.tags.includes(tag)) {
      input.value = '';
      return;
    }

    try {
      const photoRef = doc(db, 'photos', photo.id);
      await updateDoc(photoRef, {
        tags: arrayUnion(tag)
      });
      
      setSelectedPhoto(prev => ({
        ...prev,
        tags: prev.tags ? [...prev.tags, tag] : [tag]
      }));
      
      input.value = '';
    } catch (error) {
      console.error("Error adding tag:", error);
      alert("Failed to add tag.");
    }
  };

  const handleRemoveTag = async (photo, tag) => {
    try {
      const photoRef = doc(db, 'photos', photo.id);
      await updateDoc(photoRef, {
        tags: arrayRemove(tag)
      });
      
      setSelectedPhoto(prev => ({
        ...prev,
        tags: prev.tags ? prev.tags.filter(t => t !== tag) : []
      }));
    } catch (error) {
      console.error("Error removing tag:", error);
      alert("Failed to remove tag.");
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div style={{ flex: 1 }}>
        
        {/* Breadcrumbs & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 600 }}>
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link to={crumb.id === 'root' ? '/' : crumb.id === 'all' ? '/all-photos' : crumb.id === 'upload' ? '/upload' : `/folders/${crumb.id}`} style={{ color: idx === breadcrumbs.length - 1 ? 'var(--text-dark)' : 'var(--text-muted)' }}>
                  {crumb.name}
                </Link>
                {idx < breadcrumbs.length - 1 && <ChevronRight size={18} color="var(--text-muted)" />}
              </div>
            ))}
          </div>
          
          {!isAllPhotos && !isUploadView && (
            <button className="btn" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Folder
            </button>
          )}
        </div>

        {/* Upload Manager (Injects folderId) */}
        {!searchQuery && (!isAllPhotos) && (
          <UploadManager targetFolderId={folderId || null} />
        )}

        {/* Folders Section */}
        {!isAllPhotos && !isUploadView && (filteredFolders.length > 0 || searchQuery) && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Folders</h3>
            {filteredFolders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No folders match your search.</p>
            ) : (
              <div className="folder-grid">
                {filteredFolders.map(f => (
                  <Link to={`/folders/${f.id}`} key={f.id} className="folder-card" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                      <Folder size={24} color="var(--primary)" fill="rgba(0, 97, 254, 0.1)" />
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteFolder(f.id, e)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}
                      title="Delete Folder"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos Section */}
        {!isUploadView && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', margin: 0 }}>
                {isAllPhotos ? 'All Photos' : 'Photos'}
              </h3>
              {filteredPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isSelectMode ? (
                    <>
                      <button 
                        className="btn-secondary" 
                        onClick={() => {
                          setIsSelectMode(false);
                          setSelectedPhotoIds([]);
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        Cancel
                      </button>
                      <button 
                        className="btn" 
                        onClick={handleDeleteSelected}
                        disabled={selectedPhotoIds.length === 0}
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.85rem', 
                          background: selectedPhotoIds.length === 0 ? 'var(--text-muted)' : '#ff4d4f', 
                          borderColor: selectedPhotoIds.length === 0 ? 'var(--text-muted)' : '#ff4d4f',
                          cursor: selectedPhotoIds.length === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Delete Selected ({selectedPhotoIds.length})
                      </button>
                    </>
                  ) : (
                    <button 
                      className="btn-secondary" 
                      onClick={() => setIsSelectMode(true)}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      Select Multiple
                    </button>
                  )}
                </div>
              )}
            </div>
            {filteredPhotos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No photos match your criteria.</p>
            ) : (
              <div className="photo-grid">
                {filteredPhotos.map(photo => {
                  const isSelected = selectedPhotoIds.includes(photo.id);
                  return (
                    <div 
                      key={photo.id} 
                      className={`photo-card ${isSelected ? 'selected' : ''}`} 
                      onClick={() => handlePhotoClick(photo)}
                      style={{ 
                        position: 'relative',
                        outline: isSelected ? '2px solid var(--primary)' : 'none',
                        transform: isSelected ? 'scale(0.98)' : 'none'
                      }}
                    >
                      {isSelectMode && (
                        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, background: 'white', borderRadius: '4px', padding: '2px', display: 'flex', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            readOnly
                            style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                          />
                        </div>
                      )}
                      {photo.originalUrl ? (
                        <img src={photo.originalUrl} alt="Uploaded asset" />
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <FileImage size={32} />
                        </div>
                      )}
                      {(photo.status === 'processing' || photo.status === 'processing_ai') && (
                        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          AI Analyzing...
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side Panel - Photo Details */}
      {selectedPhoto && (
        <div className="right-panel glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Photo Details</h3>
            <button onClick={() => setSelectedPhoto(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>
          
          <div 
            onClick={() => setShowLightbox(true)}
            style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', background: '#eee', cursor: 'pointer', position: 'relative' }}
            title="Click to view full screen"
          >
            {selectedPhoto.originalUrl && <img src={selectedPhoto.originalUrl} alt="Preview" style={{ width: '100%', display: 'block', transition: 'filter 0.2s' }} />}
            <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
              Click to Zoom
            </div>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>AI Description</h4>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>{selectedPhoto.description || 'No description available yet.'}</p>
          </div>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Tags</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '0.75rem' }}>
              {selectedPhoto.tags?.map(t => (
                <span 
                  key={t} 
                  style={{ 
                    background: '#E8F0FE', 
                    color: 'var(--primary)', 
                    padding: '4px 8px 4px 10px', 
                    borderRadius: '12px', 
                    fontSize: '0.85rem', 
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {t}
                  <button 
                    onClick={() => handleRemoveTag(selectedPhoto, t)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--primary)' }}
                    title="Remove Tag"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
              {(!selectedPhoto.tags || selectedPhoto.tags.length === 0) && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>None</span>}
            </div>
            <form onSubmit={(e) => handleAddTag(selectedPhoto, e)} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                name="newTag" 
                placeholder="Add custom tag..." 
                style={{ 
                  flex: 1, 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border)',
                  fontSize: '0.85rem'
                }}
              />
              <button 
                type="submit" 
                className="btn" 
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              >
                Add
              </button>
            </form>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.open(selectedPhoto.originalUrl, '_blank')}>
              Download Original
            </button>
            <button 
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'center', borderColor: '#ff4d4f', color: '#ff4d4f', gap: '8px' }} 
              onClick={() => handleDeletePhoto(selectedPhoto)}
            >
              <Trash2 size={16} /> Delete Photo
            </button>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>Create New Folder</h3>
            <form onSubmit={handleCreateFolder}>
              <input 
                type="text" 
                autoFocus
                placeholder="Folder Name (e.g. 2026 Retreat)" 
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}
              />
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn">Create Folder</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Lightbox Modal for Fullscreen View */}
      {showLightbox && selectedPhoto && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowLightbox(false)} 
          style={{ background: 'rgba(0,0,0,0.9)', zIndex: 2000 }}
        >
          <button 
            onClick={() => setShowLightbox(false)} 
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 2001 }}
          >
            <X size={24} />
          </button>
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
            <img 
              src={selectedPhoto.originalUrl} 
              alt="Fullscreen View" 
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
