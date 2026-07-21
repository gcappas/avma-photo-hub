import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Folder, FileImage, Plus, ChevronRight, X } from 'lucide-react';
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
                  <Link to={`/folders/${f.id}`} key={f.id} className="folder-card">
                    <Folder size={24} color="var(--primary)" fill="rgba(0, 97, 254, 0.1)" />
                    <span style={{ fontWeight: 500, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Photos Section */}
        {!isUploadView && (
          <div>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {isAllPhotos ? 'All Photos' : 'Photos'}
            </h3>
            {filteredPhotos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No photos match your criteria.</p>
            ) : (
            <div className="photo-grid">
              {filteredPhotos.map(photo => (
                <div key={photo.id} className="photo-card" onClick={() => setSelectedPhoto(photo)}>
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
              ))}
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
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>AI Tags</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selectedPhoto.tags?.map(t => (
                <span key={t} style={{ background: '#E8F0FE', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 500 }}>
                  {t}
                </span>
              ))}
              {!selectedPhoto.tags && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>None</span>}
            </div>
          </div>
          
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.open(selectedPhoto.originalUrl, '_blank')}>
            Download Original
          </button>
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
