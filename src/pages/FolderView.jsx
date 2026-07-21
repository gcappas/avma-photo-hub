import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, getDocs, deleteDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, deleteObject } from 'firebase/storage';
import { Folder, FileImage, Plus, ChevronRight, X, Trash2, Grid, List, RotateCcw, Move, Download, Link2 } from 'lucide-react';
import UploadManager from '../components/UploadManager';

export default function FolderView({ searchQuery }) {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAllPhotos = location.pathname.startsWith('/all-photos');
  const isUploadView = location.pathname.startsWith('/upload');
  const isTrashView = location.pathname.startsWith('/trash');
  
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

  const [searchParams, setSearchParams] = useSearchParams();
  const photoParam = searchParams.get('photo');

  // UX improvements state
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [allFoldersList, setAllFoldersList] = useState([]);

  // Fetch current folder details & build recursive breadcrumbs
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
    if (isTrashView) {
      setCurrentFolder({ id: 'trash', name: 'Trash Bin' });
      setBreadcrumbs([{ id: 'trash', name: 'Trash Bin' }]);
      return;
    }

    if (!folderId) {
      setCurrentFolder({ id: 'root', name: 'Home' });
      setBreadcrumbs([{ id: 'root', name: 'Home' }]);
      return;
    }

    const fetchFolderData = async () => {
      try {
        const folderRef = doc(db, 'folders', folderId);
        const folderSnap = await getDoc(folderRef);
        if (folderSnap.exists()) {
          const data = folderSnap.data();
          setCurrentFolder({ id: folderSnap.id, ...data });
          
          // Build full recursive breadcrumb trail
          const trail = [{ id: folderSnap.id, name: data.name }];
          let parentId = data.parentId;
          
          while (parentId) {
            const parentSnap = await getDoc(doc(db, 'folders', parentId));
            if (parentSnap.exists()) {
              const pData = parentSnap.data();
              trail.unshift({ id: parentSnap.id, name: pData.name });
              parentId = pData.parentId;
            } else {
              break;
            }
          }
          trail.unshift({ id: 'root', name: 'Home' });
          setBreadcrumbs(trail);
        } else {
          navigate('/'); // invalid folder
        }
      } catch (err) {
        console.error("Error building breadcrumbs:", err);
      }
    };
    
    fetchFolderData();
  }, [folderId, navigate, isAllPhotos, isUploadView, isTrashView]);

  // Fetch subfolders
  useEffect(() => {
    if (isAllPhotos || isUploadView) return;
    
    let q;
    if (isTrashView) {
      // Fetch all folders to check status client-side
      q = query(collection(db, 'folders'));
    } else {
      const parentId = folderId || null;
      q = query(collection(db, 'folders'), where('parentId', '==', parentId));
    }
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const folderList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFolders(folderList);
      },
      (error) => {
        console.error("Firestore folders snapshot failed:", error);
      }
    );

    return unsubscribe;
  }, [folderId, isAllPhotos, isUploadView, isTrashView]);

  // Fetch photos
  useEffect(() => {
    if (isUploadView) return;
    
    // In our simplified setup, we listen to all photos and filter client-side
    const q = query(collection(db, 'photos'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const photoList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPhotos(photoList);
      },
      (error) => {
        console.error("Firestore photos snapshot failed:", error);
      }
    );

    return unsubscribe;
  }, [isUploadView]);

  // Fetch all active folders when move modal opens
  useEffect(() => {
    if (!showMoveModal) return;
    
    const fetchActiveFolders = async () => {
      try {
        const q = query(collection(db, 'folders'));
        const snap = await getDocs(q);
        const folderList = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(f => f.status !== 'deleted' && f.id !== folderId); // Exclude trash and current folder
        setAllFoldersList(folderList);
      } catch (err) {
        console.error("Failed to load active folders:", err);
      }
    };
    
    fetchActiveFolders();
  }, [showMoveModal, folderId]);

  // Auto-open selected photo on load if URL deep link is provided
  useEffect(() => {
    if (photos.length > 0) {
      if (photoParam) {
        const matched = photos.find(p => p.id === photoParam);
        if (matched) {
          setSelectedPhoto(matched);
        } else {
          setSelectedPhoto(null);
          setSearchParams({});
        }
      } else {
        setSelectedPhoto(null);
      }
    }
  }, [photos, photoParam, setSearchParams]);

  // Client-side search and folder filtering
  const filteredPhotos = photos.filter(photo => {
    // 1. Trash Filtering
    if (isTrashView) {
      if (photo.status !== 'deleted') return false;
    } else {
      if (photo.status === 'deleted') return false;
      
      // Folder Filtering
      if (!isAllPhotos) {
        const parentId = folderId || null;
        const photoFolderId = photo.folderId || null;
        if (photoFolderId !== parentId) return false;
      }
    }

    // 2. Search Filtering
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const tagsMatch = photo.tags?.some(tag => tag.toLowerCase().includes(q));
    const descMatch = photo.description?.toLowerCase().includes(q);
    const nameMatch = photo.filename?.toLowerCase().includes(q);
    return tagsMatch || descMatch || nameMatch;
  });

  const filteredFolders = folders.filter(f => {
    // 1. Trash Filtering
    if (isTrashView) {
      if (f.status !== 'deleted') return false;
    } else {
      if (f.status === 'deleted') return false;
    }

    // 2. Search Filtering
    if (!searchQuery) return true;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Highlight matching search terms helper
  const highlightText = (text, search) => {
    if (!search || !text) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === search.toLowerCase() 
        ? <mark key={index} style={{ backgroundColor: '#ffeb3b', color: '#000000', padding: '1px 3px', borderRadius: '2px' }}>{part}</mark> 
        : part
    );
  };

  // Helper: Get days left in trash
  const getDaysRemaining = (deletedAt) => {
    if (!deletedAt) return '30 days left';
    const deletedDate = deletedAt.toDate ? deletedAt.toDate() : new Date(deletedAt);
    const diffTime = Math.abs(new Date() - deletedDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = 30 - diffDays;
    return daysLeft > 0 ? `${daysLeft} days left` : 'Expiring soon';
  };

  const copyToClipboard = async (text, message = "Link copied to clipboard!") => {
    try {
      await navigator.clipboard.writeText(text);
      alert(message);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      // Fallback
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        alert(message);
      } catch (e) {
        alert("Failed to copy link. Please manually copy from address bar.");
      }
      document.body.removeChild(input);
    }
  };

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

  // RECURSIVE TRASH HELPERS
  const trashFolderRecursively = async (fId) => {
    await updateDoc(doc(db, 'folders', fId), {
      status: 'deleted',
      deletedAt: serverTimestamp()
    });
    
    // Subfolders
    const subfoldersSnap = await getDocs(query(collection(db, 'folders'), where('parentId', '==', fId)));
    for (const subDoc of subfoldersSnap.docs) {
      await trashFolderRecursively(subDoc.id);
    }
    
    // Photos
    const photosSnap = await getDocs(query(collection(db, 'photos'), where('folderId', '==', fId)));
    for (const photoDoc of photosSnap.docs) {
      await updateDoc(doc(db, 'photos', photoDoc.id), {
        status: 'deleted',
        deletedAt: serverTimestamp()
      });
    }
  };

  const restoreFolderRecursively = async (fId) => {
    await updateDoc(doc(db, 'folders', fId), {
      status: null,
      deletedAt: null
    });
    
    // Subfolders
    const subfoldersSnap = await getDocs(query(collection(db, 'folders'), where('parentId', '==', fId)));
    for (const subDoc of subfoldersSnap.docs) {
      await restoreFolderRecursively(subDoc.id);
    }
    
    // Photos
    const photosSnap = await getDocs(query(collection(db, 'photos'), where('folderId', '==', fId)));
    for (const photoDoc of photosSnap.docs) {
      await updateDoc(doc(db, 'photos', photoDoc.id), {
        status: 'ready',
        deletedAt: null
      });
    }
  };

  const deleteFolderPermanently = async (fId) => {
    await deleteDoc(doc(db, 'folders', fId));
    
    // Subfolders
    const subfoldersSnap = await getDocs(query(collection(db, 'folders'), where('parentId', '==', fId)));
    for (const subDoc of subfoldersSnap.docs) {
      await deleteFolderPermanently(subDoc.id);
    }
    
    // Photos
    const photosSnap = await getDocs(query(collection(db, 'photos'), where('folderId', '==', fId)));
    for (const photoDoc of photosSnap.docs) {
      const photo = { id: photoDoc.id, ...photoDoc.data() };
      await deleteDoc(doc(db, 'photos', photo.id));
      if (photo.storagePath) {
        const storageRef = ref(storage, photo.storagePath);
        await deleteObject(storageRef).catch((err) => {
          console.warn("Storage deletion failed during cleanup:", err);
        });
      }
    }
  };

  // HANDLERS
  const handleDeleteFolder = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const confirmMsg = "Are you sure you want to move this folder to the Trash Bin? This will also move all folders and photos inside it.";
    if (!window.confirm(confirmMsg)) return;
    
    try {
      await trashFolderRecursively(id);
    } catch (error) {
      console.error("Error moving folder to trash:", error);
      alert("Failed to move folder to trash.");
    }
  };

  const handleDeletePhoto = async (photo) => {
    if (isTrashView) {
      if (!window.confirm("Are you sure you want to permanently delete this photo? This cannot be undone.")) return;
      try {
        await deleteDoc(doc(db, 'photos', photo.id));
        if (photo.storagePath) {
          const storageRef = ref(storage, photo.storagePath);
          await deleteObject(storageRef).catch(() => {});
        }
        setSelectedPhoto(null);
      } catch (err) {
        console.error("Permanent delete failed:", err);
      }
      return;
    }

    if (!window.confirm("Move this photo to the Trash Bin?")) return;
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        status: 'deleted',
        deletedAt: serverTimestamp()
      });
      setSelectedPhoto(null);
    } catch (error) {
      console.error("Error trashing photo:", error);
      alert("Failed to trash photo.");
    }
  };

  const handleRestorePhoto = async (photo) => {
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        status: 'ready',
        deletedAt: null
      });
      setSelectedPhoto(null);
      alert("Photo restored successfully!");
    } catch (err) {
      console.error("Restore failed:", err);
    }
  };

  const handleRestoreFolder = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await restoreFolderRecursively(id);
      alert("Folder and all contents restored!");
    } catch (err) {
      console.error("Folder restore failed:", err);
    }
  };

  const handlePermanentDeleteFolder = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Permanently delete this folder and all contents? This cannot be undone.")) return;
    try {
      await deleteFolderPermanently(id);
      alert("Folder permanently deleted.");
    } catch (err) {
      console.error("Permanent deletion failed:", err);
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
      setSearchParams({ photo: photo.id });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPhotoIds.length === 0) return;
    
    if (isTrashView) {
      if (!window.confirm(`Permanently delete the ${selectedPhotoIds.length} selected photos? This cannot be undone.`)) return;
      const idsToDelete = [...selectedPhotoIds];
      const photosToDelete = photos.filter(p => idsToDelete.includes(p.id));
      
      setIsSelectMode(false);
      setSelectedPhotoIds([]);
      if (selectedPhoto && idsToDelete.includes(selectedPhoto.id)) setSelectedPhoto(null);
      
      for (const photo of photosToDelete) {
        try {
          await deleteDoc(doc(db, 'photos', photo.id));
          if (photo.storagePath) {
            const storageRef = ref(storage, photo.storagePath);
            await deleteObject(storageRef).catch(() => {});
          }
        } catch (err) {}
      }
      return;
    }

    if (!window.confirm(`Move the ${selectedPhotoIds.length} selected photos to the Trash Bin?`)) return;
    
    const idsToTrash = [...selectedPhotoIds];
    setIsSelectMode(false);
    setSelectedPhotoIds([]);
    if (selectedPhoto && idsToTrash.includes(selectedPhoto.id)) setSelectedPhoto(null);

    for (const id of idsToTrash) {
      try {
        await updateDoc(doc(db, 'photos', id), {
          status: 'deleted',
          deletedAt: serverTimestamp()
        });
      } catch (err) {}
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedPhotoIds.length === 0) return;
    const idsToRestore = [...selectedPhotoIds];
    setIsSelectMode(false);
    setSelectedPhotoIds([]);
    
    for (const id of idsToRestore) {
      try {
        await updateDoc(doc(db, 'photos', id), {
          status: 'ready',
          deletedAt: null
        });
      } catch (err) {}
    }
    alert("Restored selected items.");
  };

  const handleMoveSelected = async (targetId) => {
    const destId = targetId === 'root' ? null : targetId;
    try {
      for (const id of selectedPhotoIds) {
        await updateDoc(doc(db, 'photos', id), {
          folderId: destId
        });
      }
      setIsSelectMode(false);
      setSelectedPhotoIds([]);
      setShowMoveModal(false);
      alert("Photos moved successfully!");
    } catch (err) {
      console.error("Move failed:", err);
    }
  };

  const handleDownloadSelected = () => {
    const selectedPhotos = photos.filter(p => selectedPhotoIds.includes(p.id));
    selectedPhotos.forEach(p => {
      const link = document.createElement('a');
      link.href = p.originalUrl;
      link.target = '_blank';
      link.download = p.filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    setIsSelectMode(false);
    setSelectedPhotoIds([]);
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
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <div style={{ flex: 1 }}>
        
        {/* Breadcrumbs & View Toggle Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.25rem', fontWeight: 600 }}>
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Link to={crumb.id === 'root' ? '/' : crumb.id === 'all' ? '/all-photos' : crumb.id === 'upload' ? '/upload' : crumb.id === 'trash' ? '/trash' : `/folders/${crumb.id}`} style={{ color: idx === breadcrumbs.length - 1 ? 'var(--text-dark)' : 'var(--text-muted)' }}>
                  {crumb.name}
                </Link>
                {idx < breadcrumbs.length - 1 && <ChevronRight size={18} color="var(--text-muted)" />}
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Grid / List Layout Selector */}
            {!isUploadView && (
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
                <button 
                  onClick={() => setViewMode('grid')}
                  style={{ background: viewMode === 'grid' ? '#E8F0FE' : 'white', border: 'none', padding: '6px 10px', cursor: 'pointer', display: 'flex', color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)' }}
                  title="Grid View"
                >
                  <Grid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{ background: viewMode === 'list' ? '#E8F0FE' : 'white', border: 'none', padding: '6px 10px', cursor: 'pointer', display: 'flex', color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)' }}
                  title="List View"
                >
                  <List size={18} />
                </button>
              </div>
            )}

            {!isUploadView && !isTrashView && (
              <button 
                className="btn-secondary" 
                onClick={() => {
                  const url = window.location.href.split('?')[0];
                  copyToClipboard(url, "Folder link copied to clipboard!");
                }}
                style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: '1px solid var(--border)', background: 'white' }}
              >
                <Link2 size={16} /> Copy Folder Link
              </button>
            )}

            {!isAllPhotos && !isUploadView && !isTrashView && (
              <button className="btn" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} /> New Folder
              </button>
            )}
          </div>
        </div>

        {/* Upload Manager (Hidden in Trash View) */}
        {!searchQuery && !isAllPhotos && !isTrashView && (
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
                  <div key={f.id} className="folder-card" style={{ justifyContent: 'space-between', display: 'flex', alignItems: 'center' }}>
                    <Link to={`/folders/${f.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden', flex: 1 }}>
                      <Folder size={24} color="var(--primary)" fill="rgba(0, 97, 254, 0.1)" />
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {highlightText(f.name, searchQuery)}
                      </span>
                    </Link>
                    
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {isTrashView ? (
                        <>
                          <button 
                            onClick={(e) => handleRestoreFolder(f.id, e)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'green', padding: '4px' }}
                            title="Restore Folder"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button 
                            onClick={(e) => handlePermanentDeleteFolder(f.id, e)} 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f', padding: '4px' }}
                            title="Delete Permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={(e) => handleDeleteFolder(f.id, e)} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' }}
                          title="Move Folder to Trash"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
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
                {isTrashView ? 'Deleted Photos' : isAllPhotos ? 'All Photos' : 'Photos'}
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
                      
                      {!isTrashView && (
                        <>
                          <button 
                            className="btn-secondary" 
                            onClick={handleDownloadSelected}
                            disabled={selectedPhotoIds.length === 0}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', gap: '4px' }}
                          >
                            <Download size={14} /> Download Selected
                          </button>
                          <button 
                            className="btn-secondary" 
                            onClick={() => setShowMoveModal(true)}
                            disabled={selectedPhotoIds.length === 0}
                            style={{ padding: '6px 12px', fontSize: '0.85rem', gap: '4px' }}
                          >
                            <Move size={14} /> Move Selected
                          </button>
                        </>
                      )}

                      {isTrashView && (
                        <button 
                          className="btn-secondary" 
                          onClick={handleRestoreSelected}
                          disabled={selectedPhotoIds.length === 0}
                          style={{ padding: '6px 12px', fontSize: '0.85rem', color: 'green', borderColor: 'green' }}
                        >
                          Restore Selected
                        </button>
                      )}

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
                        {isTrashView ? 'Delete Permanently' : 'Delete Selected'} ({selectedPhotoIds.length})
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
            ) : viewMode === 'grid' ? (
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
                      
                      {/* Trash remaining days badge */}
                      {isTrashView && (
                        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: '#ff4d4f', color: 'white', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          {getDaysRemaining(photo.deletedAt)}
                        </div>
                      )}

                      {photo.originalUrl ? (
                        <img src={photo.originalUrl} alt="Uploaded asset" />
                      ) : (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                          <FileImage size={32} />
                        </div>
                      )}
                      {!isTrashView && (photo.status === 'processing' || photo.status === 'processing_ai') && (
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
            ) : (
              /* Compact List View */
              <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#F7F9FA', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      {isSelectMode && <th style={{ padding: '12px', width: '40px' }}></th>}
                      <th style={{ padding: '12px', width: '60px' }}>Preview</th>
                      <th style={{ padding: '12px' }}>Name</th>
                      <th style={{ padding: '12px', width: '120px' }}>Size</th>
                      {isTrashView ? (
                        <th style={{ padding: '12px', width: '140px' }}>Expires In</th>
                      ) : (
                        <th style={{ padding: '12px', width: '200px' }}>Tags</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPhotos.map(photo => {
                      const isSelected = selectedPhotoIds.includes(photo.id);
                      const sizeMB = photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown';
                      return (
                        <tr 
                          key={photo.id} 
                          onClick={() => handlePhotoClick(photo)}
                          style={{ 
                            borderBottom: '1px solid var(--border)', 
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(0, 97, 254, 0.05)' : 'white'
                          }}
                        >
                          {isSelectMode && (
                            <td style={{ padding: '12px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => handlePhotoClick(photo)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {photo.originalUrl ? (
                                <img src={photo.originalUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <FileImage size={18} color="var(--text-muted)" />
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-dark)' }}>
                            {highlightText(photo.filename, searchQuery)}
                          </td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                            {sizeMB}
                          </td>
                          {isTrashView ? (
                            <td style={{ padding: '12px', color: '#ff4d4f', fontWeight: 600 }}>
                              {getDaysRemaining(photo.deletedAt)}
                            </td>
                          ) : (
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {photo.tags?.slice(0, 2).map(t => (
                                  <span key={t} style={{ background: '#E8F0FE', color: 'var(--primary)', padding: '2px 6px', borderRadius: '8px', fontSize: '0.75rem' }}>
                                    {highlightText(t, searchQuery)}
                                  </span>
                                ))}
                                {photo.tags && photo.tags.length > 2 && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>+{photo.tags.length - 2}</span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
            <button onClick={() => { setSelectedPhoto(null); setSearchParams({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
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
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Filename</h4>
            <p style={{ fontSize: '0.95rem', fontWeight: 500, wordBreak: 'break-all' }}>
              {highlightText(selectedPhoto.filename, searchQuery)}
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>AI Description</h4>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
              {highlightText(selectedPhoto.description || 'No description available yet.', searchQuery)}
            </p>
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
                  {highlightText(t, searchQuery)}
                  {!isTrashView && (
                    <button 
                      onClick={() => handleRemoveTag(selectedPhoto, t)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--primary)' }}
                      title="Remove Tag"
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              ))}
              {(!selectedPhoto.tags || selectedPhoto.tags.length === 0) && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>None</span>}
            </div>
            
            {!isTrashView && (
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
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {isTrashView ? (
              <>
                <button 
                  className="btn" 
                  style={{ width: '100%', justifyContent: 'center', background: 'green', borderColor: 'green' }} 
                  onClick={() => handleRestorePhoto(selectedPhoto)}
                >
                  <RotateCcw size={16} style={{ marginRight: '6px' }} /> Restore Photo
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', borderColor: '#ff4d4f', color: '#ff4d4f', gap: '8px' }} 
                  onClick={() => handleDeletePhoto(selectedPhoto)}
                >
                  <Trash2 size={16} /> Delete Permanently
                </button>
              </>
            ) : (
              <>
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', gap: '8px' }} 
                  onClick={() => {
                    const url = `${window.location.origin}${location.pathname}?photo=${selectedPhoto.id}`;
                    copyToClipboard(url, "Photo link copied to clipboard!");
                  }}
                >
                  <Link2 size={16} /> Copy Shareable Link
                </button>
                <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.open(selectedPhoto.originalUrl, '_blank')}>
                  Download Original
                </button>
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', borderColor: '#ff4d4f', color: '#ff4d4f', gap: '8px' }} 
                  onClick={() => handleDeletePhoto(selectedPhoto)}
                >
                  <Trash2 size={16} /> Move to Trash
                </button>
              </>
            )}
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

      {/* Bulk Move Modal Folder Picker */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Move Selected Photos</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Select destination folder:</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1.5rem' }}>
              <div 
                onClick={() => handleMoveSelected('root')}
                style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', hover: { background: '#f5f5f5' }, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
              >
                <Folder size={18} color="var(--primary)" /> Home (Root)
              </div>
              {allFoldersList.map(folder => (
                <div 
                  key={folder.id}
                  onClick={() => handleMoveSelected(folder.id)}
                  style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <Folder size={18} color="var(--primary)" fill="rgba(0, 97, 254, 0.1)" /> {folder.name}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowMoveModal(false)}>Cancel</button>
            </div>
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
