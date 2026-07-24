import { useState, useEffect } from 'react';
import { X, Plus, Link2, Download, Trash2, Loader2, RotateCcw, ChevronLeft, ChevronRight, Heart, Layers } from 'lucide-react';
import { collection, query, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

export default function PhotoDetailsModal({ photo, onClose, onDownload, onDelete, onRemoveFromCollection, onAddTag, onRemoveTag, isTrashView, onRestore, onNext, onPrev, hasNext, hasPrev, onToggleFavorite }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [collectionsList, setCollectionsList] = useState([]);

  useEffect(() => {
    if (!showCollectionModal) return;
    const fetchCollections = async () => {
      try {
        const q = query(collection(db, 'collections'));
        const snap = await getDocs(q);
        const colList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCollectionsList(colList);
      } catch (err) {
        console.error("Failed to load collections:", err);
      }
    };
    fetchCollections();
  }, [showCollectionModal]);

  const handleAddToCollection = async (collectionId) => {
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        collections: arrayUnion(collectionId)
      });
      setShowCollectionModal(false);
      // We don't necessarily need an alert, but it gives good feedback
      alert('Photo added to collection!');
    } catch (err) {
      console.error(err);
      alert('Failed to add to collection');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext && onNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!photo) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content lightbox-modal" onClick={e => e.stopPropagation()}>
        
        {/* Left Side - Large Photo Viewer with Nav Arrows */}
        <div className="lightbox-photo-container">
          {hasPrev && (
            <button className="nav-arrow left-arrow" onClick={onPrev} data-tooltip="Previous (Left Arrow)">
              <ChevronLeft size={36} />
            </button>
          )}
          
          <img src={photo.originalUrl} alt={photo.filename} className="lightbox-img" />

          {hasNext && (
            <button className="nav-arrow right-arrow" onClick={onNext} data-tooltip="Next (Right Arrow)">
              <ChevronRight size={36} />
            </button>
          )}
        </div>

        {/* Right Side - Photo Details Panel */}
        <div className="lightbox-details-panel">
          <div className="details-header">
            <h3 style={{ margin: 0 }}>Photo Details</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isTrashView && (
                <button 
                  className="icon-btn" 
                  onClick={() => onToggleFavorite && onToggleFavorite(photo)}
                  style={{ color: photo.isFavorite ? '#e91e63' : 'inherit' }}
                  data-tooltip={photo.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Heart size={20} fill={photo.isFavorite ? '#e91e63' : 'none'} />
                </button>
              )}
              <button className="icon-btn" onClick={onClose} data-tooltip="Close">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="details-scrollable">
            <div className="info-section">
              <h4 className="filename-title">{photo.filename}</h4>
              <p className="file-meta">
                Size: {photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown'}
              </p>
            </div>

            {photo.exif && (
              <div className="info-section" style={{ background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>
                <h5 style={{ marginTop: 0, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>Camera EXIF Metadata</h5>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {photo.exif.make && <div><strong>Camera:</strong> {photo.exif.make} {photo.exif.model}</div>}
                  {photo.exif.lens && <div><strong>Lens:</strong> {photo.exif.lens}</div>}
                  {photo.exif.dateTimeOriginal && <div><strong>Date:</strong> {new Date(photo.exif.dateTimeOriginal).toLocaleDateString()}</div>}
                  {photo.exif.latitude && <div><strong>GPS:</strong> {photo.exif.latitude.toFixed(4)}, {photo.exif.longitude?.toFixed(4)}</div>}
                </div>
              </div>
            )}

            {photo.description && (
              <div className="info-section">
                <h5>AI Description</h5>
                <p className="ai-desc-box">{photo.description}</p>
              </div>
            )}

            <div className="info-section">
              <h5>Tags</h5>
              <div className="tags-flex">
                {photo.tags?.map(t => (
                  <span key={t} className="tag-badge">
                    {t}
                    <X size={12} className="remove-tag-icon" onClick={() => onRemoveTag(photo, t)} />
                  </span>
                ))}
              </div>

              <form onSubmit={e => onAddTag(photo, e)} className="add-tag-form">
                <input type="text" name="newTag" placeholder="Add tag..." />
                <button type="submit" className="btn-secondary"><Plus size={14} /></button>
              </form>
            </div>
          </div>

          <div className="details-footer actions-stack">
            {isTrashView ? (
              <>
                <button 
                  className="btn full-width" 
                  style={{ background: 'green', borderColor: 'green' }}
                  onClick={() => onRestore && onRestore(photo)}
                >
                  <RotateCcw size={16} style={{ marginRight: '6px' }} /> Restore Photo
                </button>
                <button 
                  className="btn-secondary full-width delete-btn" 
                  onClick={() => onDelete(photo)}
                >
                  <Trash2 size={16} /> Delete Permanently
                </button>
              </>
            ) : (
              <>
                <button 
                  className="btn-secondary full-width" 
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?photo=${photo.id}`;
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(url);
                      alert("Photo link copied to clipboard!");
                    }
                  }}
                >
                  <Link2 size={16} /> Copy Link
                </button>
                
                <button 
                  className="btn-secondary full-width" 
                  onClick={() => setShowCollectionModal(true)}
                >
                  <Layers size={16} /> Add to Collection
                </button>
                
                <button 
                  className="btn full-width" 
                  disabled={isDownloading}
                  onClick={async () => {
                    setIsDownloading(true);
                    await onDownload(photo);
                    setIsDownloading(false);
                  }}
                >
                  {isDownloading ? <Loader2 size={16} className="spinner" /> : <><Download size={16} /> Download Original</>}
                </button>

                {onRemoveFromCollection ? (
                  <button 
                    className="btn-secondary full-width delete-btn" 
                    onClick={() => onRemoveFromCollection(photo)}
                  >
                    <X size={16} /> Remove from Collection
                  </button>
                ) : (
                  <button 
                    className="btn-secondary full-width delete-btn" 
                    onClick={() => onDelete(photo)}
                  >
                    <Trash2 size={16} /> Move to Trash
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showCollectionModal && (
        <div className="modal-overlay" onClick={() => setShowCollectionModal(false)} style={{ zIndex: 3000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
             <h3 style={{ margin: '0 0 1rem 0' }}>Add to Collection</h3>
             <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
                {collectionsList.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No collections found.</div>
                ) : (
                  collectionsList.map(col => (
                    <div 
                      key={col.id} 
                      onClick={() => handleAddToCollection(col.id)} 
                      style={{ 
                        padding: '12px', 
                        cursor: 'pointer', 
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-light)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Layers size={16} color="var(--primary)" />
                      {col.name}
                    </div>
                  ))
                )}
             </div>
             <button className="btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => setShowCollectionModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
