import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, arrayRemove, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Link, useSearchParams } from 'react-router-dom';
import { Folder, FileImage, Image as ImageIcon, Trash2, Tag, Move, Layers, Grid, List as ListIcon, X, Plus } from 'lucide-react';
import PhotoDetailsModal from '../components/PhotoDetailsModal';

export default function CollectionsView({ searchQuery }) {
  const [collectionsList, setCollectionsList] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const photoParam = searchParams.get('photo');
  
  const [visibleCount, setVisibleCount] = useState(48);

  useEffect(() => {
    const q = query(collection(db, 'collections'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCollectionsList(list);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    let q;
    if (activeCollectionId) {
      q = query(collection(db, 'photos'), where('collections', 'array-contains', activeCollectionId));
    } else {
      setPhotos([]);
      return;
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => p.status !== 'deleted');
      setPhotos(list);
    });
    return unsubscribe;
  }, [activeCollectionId]);

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      await addDoc(collection(db, 'collections'), {
        name: newCollectionName.trim(),
        createdAt: serverTimestamp()
      });
      setNewCollectionName('');
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to create collection');
    }
  };

  const handleDeleteCollection = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Remove this collection? Your original photos will NOT be removed or deleted.")) return;
    try {
      await deleteDoc(doc(db, 'collections', id));
      if (activeCollectionId === id) setActiveCollectionId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredPhotos = useMemo(() => {
    if (!activeCollectionId) return [];
    const rawQuery = (searchQuery || '').trim().toLowerCase();
    const terms = rawQuery.split(/\s+/).filter(Boolean);
    if (terms.length === 0) return photos;
    
    return photos.filter(photo => {
      const filename = (photo.filename || '').toLowerCase();
      const tags = (photo.tags || []).map(t => t.trim().toLowerCase());
      return terms.every(term => filename.includes(term) || tags.includes(term));
    });
  }, [photos, activeCollectionId, searchQuery]);

  // Deep Link logic
  useEffect(() => {
    if (photoParam && filteredPhotos.length > 0) {
      const matched = filteredPhotos.find(p => p.id === photoParam);
      if (matched) setSelectedPhoto(matched);
    }
  }, [photoParam, filteredPhotos]);

  const toggleSelection = (id) => {
    setSelectedPhotoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const removeSelectedFromCollection = async () => {
    if (!window.confirm("Remove selected photos from this collection?")) return;
    try {
      for (const id of selectedPhotoIds) {
        await updateDoc(doc(db, 'photos', id), {
          collections: arrayRemove(activeCollectionId)
        });
      }
      setSelectedPhotoIds([]);
      setIsSelectMode(false);
    } catch (err) {
      console.error(err);
    }
  };

  const downloadSinglePhoto = async (photo) => {
    const filename = photo.filename || 'download.jpg';
    try {
      const resp = await fetch(photo.originalUrl);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      const proxyUrl = `https://us-east1-avma-photo-hub-2026.cloudfunctions.net/downloadPhoto?url=${encodeURIComponent(photo.originalUrl)}&filename=${encodeURIComponent(filename)}`;
      const link = document.createElement('a');
      link.href = proxyUrl;
      link.target = '_self';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const currentIndex = selectedPhoto ? filteredPhotos.findIndex(p => p.id === selectedPhoto.id) : -1;
  const hasNext = currentIndex >= 0 && currentIndex < filteredPhotos.length - 1;
  const hasPrev = currentIndex > 0;
  
  const handleNext = () => {
    if (hasNext) {
      const nextPhoto = filteredPhotos[currentIndex + 1];
      setSelectedPhoto(nextPhoto);
      setSearchParams({ photo: nextPhoto.id });
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      const prevPhoto = filteredPhotos[currentIndex - 1];
      setSelectedPhoto(prevPhoto);
      setSearchParams({ photo: prevPhoto.id });
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      {/* Sidebar for Collections */}
      <div style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Collections</h2>
          <button onClick={() => setShowCreateModal(true)} className="icon-btn" data-tooltip="New Collection">
            <Layers size={18} />
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          {collectionsList.map(col => (
            <div 
              key={col.id} 
              onClick={() => { setActiveCollectionId(col.id); setIsSelectMode(false); setSelectedPhotoIds([]); }}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: activeCollectionId === col.id ? 'var(--primary)' : 'white',
                color: activeCollectionId === col.id ? 'white' : 'var(--text-dark)',
                border: activeCollectionId === col.id ? 'none' : '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: activeCollectionId === col.id ? '0 4px 12px rgba(0, 97, 254, 0.2)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <Layers size={16} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
              </div>
              <button 
                className="icon-btn" 
                onClick={(e) => handleDeleteCollection(col.id, e)}
                style={{ color: activeCollectionId === col.id ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}
                data-tooltip="Remove Collection"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {collectionsList.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'var(--bg-light)', borderRadius: '8px' }}>
              Use Collections to bundle photos for a specific project. Click the icon above to create one.
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!activeCollectionId ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '1rem', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
            <Layers size={48} color="var(--primary)" opacity={0.5} />
            <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>About Collections</h3>
            <p style={{ lineHeight: 1.6 }}>
              Collections allow you to curate specific projects or albums (like "August Newsletter Project" or "Homepage Assets") without duplicating your original photos. 
              <br/><br/>
              While <strong>Tags</strong> describe <em>what</em> a photo is, <strong>Collections</strong> are for grouping photos for a specific <em>purpose</em>.
            </p>
            <p style={{ fontSize: '0.9rem' }}>Select a collection on the left, or create a new one to get started!</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>
                  {collectionsList.find(c => c.id === activeCollectionId)?.name || 'Collection'}
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {filteredPhotos.length} photos
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Link 
                  to="/all-photos?selectMode=true" 
                  className="btn"
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                >
                  <Plus size={16} style={{ marginRight: '6px' }} /> Add Photos
                </Link>
                {filteredPhotos.length > 0 && (
                  <button 
                    onClick={() => {
                      setIsSelectMode(!isSelectMode);
                      if (isSelectMode) setSelectedPhotoIds([]);
                    }}
                    className={`btn-secondary ${isSelectMode ? 'active' : ''}`}
                    style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', background: isSelectMode ? 'var(--primary)' : '', color: isSelectMode ? 'white' : '' }}
                  >
                    {isSelectMode ? 'Cancel Selection' : 'Select Photos'}
                  </button>
                )}
              </div>
            </div>

            {filteredPhotos.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'white', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                 <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-dark)' }}>This collection is empty</h3>
                 <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6, maxWidth: '400px', margin: '0 auto 2rem auto' }}>
                   To add photos here, go to <strong>All Photos</strong> or one of your <strong>Folders</strong>, click "Select Photos", check the ones you want, and click the <strong>Layers icon</strong> at the bottom of the screen.
                 </p>
                 <Link to="/all-photos" className="btn" style={{ display: 'inline-flex', textDecoration: 'none' }}>
                   Go to All Photos
                 </Link>
               </div>
            ) : (
              <div className="photo-grid">
                {filteredPhotos.slice(0, visibleCount).map((photo, index) => {
                  const isSelected = selectedPhotoIds.includes(photo.id);
                  const imageUrl = photo.thumbnailUrl || photo.originalUrl;
                  
                  return (
                    <div 
                      key={photo.id} 
                      className={`photo-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => isSelectMode ? toggleSelection(photo.id) : setSelectedPhoto(photo)}
                      style={{ border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)' }}
                    >
                      {isSelectMode && (
                        <div className={`selection-check ${isSelected ? 'active' : ''}`}>
                          {isSelected && <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                      )}
                      
                      <div className="photo-card-image" style={{ background: '#f5f5f5' }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt={photo.filename} loading={index < 12 ? "eager" : "lazy"} decoding="async" />
                        ) : (
                          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <FileImage size={32} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {filteredPhotos.length > visibleCount && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                <button className="btn-secondary" onClick={() => setVisibleCount(prev => prev + 48)}>
                  Load More Photos
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Batch Operations Bar */}
      {isSelectMode && selectedPhotoIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
          padding: '12px 24px', borderRadius: '100px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1000,
          border: '1px solid rgba(0,0,0,0.05)'
        }}>
          <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{selectedPhotoIds.length} Selected</span>
          <div style={{ width: 1, height: 24, background: 'var(--border)' }}></div>
          <button onClick={removeSelectedFromCollection} style={{ background: 'none', border: 'none', color: '#e53935', fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem' }} data-tooltip="Remove from Collection">
            Remove
          </button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem' }}>Create New Collection</h3>
            <form onSubmit={handleCreateCollection}>
              <input 
                type="text" autoFocus
                placeholder="Collection Name (e.g. Website Assets)" 
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}
              />
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn">Create Collection</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Lightbox */}
      {selectedPhoto && (
        <PhotoDetailsModal 
          photo={selectedPhoto}
          onClose={() => { setSelectedPhoto(null); setSearchParams({}); }}
          onDownload={() => downloadSinglePhoto(selectedPhoto)}
          onRemoveFromCollection={async (photo) => {
            if (!window.confirm("Remove photo from this collection?")) return;
            await updateDoc(doc(db, 'photos', photo.id), {
              collections: arrayRemove(activeCollectionId)
            });
            setSelectedPhoto(null);
          }}
          onAddTag={async (e) => {
            e.preventDefault();
            const tag = e.target.elements.newTag.value.trim().toLowerCase();
            if(!tag) return;
            await updateDoc(doc(db, 'photos', selectedPhoto.id), { tags: [...(selectedPhoto.tags||[]), tag] });
            setSelectedPhoto(p => ({...p, tags: [...(p.tags||[]), tag]}));
            e.target.elements.newTag.value = '';
          }}
          onRemoveTag={async (t) => {
            await updateDoc(doc(db, 'photos', selectedPhoto.id), { tags: selectedPhoto.tags.filter(x => x !== t) });
            setSelectedPhoto(p => ({...p, tags: p.tags.filter(x => x !== t)}));
          }}
          isTrashView={false}
          onNext={handleNext}
          onPrev={handlePrev}
          hasNext={hasNext}
          hasPrev={hasPrev}
          onToggleFavorite={async () => {
             const newFav = !selectedPhoto.isFavorite;
             await updateDoc(doc(db, 'photos', selectedPhoto.id), { isFavorite: newFav });
             setSelectedPhoto(p => ({...p, isFavorite: newFav}));
          }}
        />
      )}
    </div>
  );
}
