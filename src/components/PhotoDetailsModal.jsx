import { useState, useEffect } from 'react';
import { X, Plus, Link2, Download, Trash2, Loader2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function PhotoDetailsModal({ photo, onClose, onDownload, onDelete, onAddTag, onRemoveTag, isTrashView, onRestore, onNext, onPrev, hasNext, hasPrev }) {
  const [isDownloading, setIsDownloading] = useState(false);

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
            <button className="nav-arrow left-arrow" onClick={onPrev}>
              <ChevronLeft size={36} />
            </button>
          )}
          
          <img src={photo.originalUrl} alt={photo.filename} className="lightbox-img" />

          {hasNext && (
            <button className="nav-arrow right-arrow" onClick={onNext}>
              <ChevronRight size={36} />
            </button>
          )}
        </div>

        {/* Right Side - Photo Details Panel */}
        <div className="lightbox-details-panel">
          <div className="details-header">
            <h3>Photo Details</h3>
            <button className="icon-btn" onClick={onClose}><X size={20} /></button>
          </div>

          <div className="details-scrollable">
            <div className="info-section">
              <h4 className="filename-title">{photo.filename}</h4>
              <p className="file-meta">
                Size: {photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown'}
              </p>
            </div>

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
                  <Link2 size={16} /> Copy Shareable Link
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

                <button 
                  className="btn-secondary full-width delete-btn" 
                  onClick={() => onDelete(photo)}
                >
                  <Trash2 size={16} /> Move to Trash
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
