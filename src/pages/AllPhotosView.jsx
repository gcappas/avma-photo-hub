import { useState, useEffect, useMemo, forwardRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, limit, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, deleteObject } from 'firebase/storage';
import { FileImage, Grid, List, Download, Link2, Trash2, X, Plus, RotateCcw, Loader2, Sparkles, Filter, CheckSquare, Square, Heart } from 'lucide-react';
import PhotoDetailsModal from '../components/PhotoDetailsModal';
import BatchOperations from '../components/BatchOperations';

export default function AllPhotosView({ searchQuery, viewMode = 'all' }) {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const photoParam = searchParams.get('photo');
  const location = useLocation();

  const [visibleCount, setVisibleCount] = useState(48);

  // Check for selectMode in URL
  useEffect(() => {
    if (searchParams.get('selectMode') === 'true') {
      setIsSelectMode(true);
      setSearchParams(prev => {
        prev.delete('selectMode');
        return prev;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setVisibleCount(48);
  }, [selectedCategory, searchQuery]);
  // Fetch photos
  useEffect(() => {
    const q = query(collection(db, 'photos'), limit(500));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }));
        
      let filtered = list;
      if (viewMode === 'trash') {
        filtered = list.filter(p => p.status === 'deleted');
      } else {
        filtered = list.filter(p => p.status !== 'deleted');
        if (viewMode === 'favorites') {
          filtered = filtered.filter(p => p.isFavorite === true);
        }
      }
      setPhotos(filtered);
      setSelectedPhotoIds([]);
      setIsSelectMode(false);
    });
    return unsubscribe;
  }, [viewMode]);



  // Extract top 8 AI Category Tags dynamically for filter chips
  // Dynamically extract all unique AI Category Tags for dropdown filter
  const allUniqueTags = useMemo(() => {
    const counts = {};
    photos.forEach(p => {
      if (p.tags) {
        p.tags.forEach(tag => {
          const t = tag.trim();
          if (t) {
            const formatted = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
            counts[formatted] = (counts[formatted] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [photos]);

  // Client-side search and category filtering
  const filteredPhotos = useMemo(() => {
    const rawQuery = (searchQuery || '').trim().toLowerCase();
    const terms = rawQuery.split(/\s+/).filter(Boolean);

    return photos.filter(photo => {
      // 1. Category Dropdown Filtering
      if (selectedCategory !== 'All') {
        const cat = selectedCategory.toLowerCase();
        const escapeRegex = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${escapeRegex(cat)}(s|es)?\\b`, 'i');

        const hasTag = photo.tags?.some(t => {
          const cleanT = t.trim().toLowerCase();
          return cleanT === cat || cleanT === cat + 's' || cleanT + 's' === cat;
        });
        const inDesc = wordRegex.test(photo.description || '');

        if (!hasTag && !inDesc) return false;
      }

      // 2. Search Query Filtering
      if (terms.length === 0) return true;

      const filename = (photo.filename || '').toLowerCase();
      const description = (photo.description || '').toLowerCase();
      const tags = (photo.tags || []).map(t => t.trim().toLowerCase());

      return terms.every(term => {
        // Whole-word regex match to prevent "education", "location", "publication" matching "cat"
        const escapeRegex = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        const wordRegex = new RegExp(`\\b${escapeRegex(term)}(s|es)?\\b`, 'i');

        const inFilename = wordRegex.test(filename) || filename.includes(term);
        const inDesc = wordRegex.test(description);
        const inTags = tags.some(t => t === term || t === term + 's' || t + 's' === term || wordRegex.test(t));

        return inFilename || inDesc || inTags;
      });
    }).sort((a, b) => {
      // Sort by active tags first (match count), then by created date
      const aMatches = Array.isArray(a.tags) ? a.tags.filter(t => terms.includes(t)).length : 0;
      const bMatches = Array.isArray(b.tags) ? b.tags.filter(t => terms.includes(t)).length : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });
  }, [photos, selectedCategory, searchQuery]);

  // Auto-open selected photo on load if URL deep link is provided
  useEffect(() => {
    if (photoParam && filteredPhotos.length > 0) {
      const matched = filteredPhotos.find(p => p.id === photoParam);
      if (matched) {
        setSelectedPhoto(matched);
      }
    }
  }, [photoParam, filteredPhotos]);

  const handlePhotoClick = (photo, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
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
  
  const handleToggleFavorite = async (photo) => {
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        isFavorite: !photo.isFavorite
      });
      // If modal is open, we should also update the selectedPhoto state so it re-renders immediately
      if (selectedPhoto && selectedPhoto.id === photo.id) {
        setSelectedPhoto({ ...photo, isFavorite: !photo.isFavorite });
      }
    } catch (err) {
      console.error("Failed to toggle favorite", err);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedPhotoIds.length === 0) return;
    if (!window.confirm(`Move ${selectedPhotoIds.length} photos to the Trash Bin?`)) return;
    
    try {
      const promises = selectedPhotoIds.map(id => 
        updateDoc(doc(db, 'photos', id), {
          status: 'deleted',
          deletedAt: new Date()
        })
      );
      await Promise.all(promises);
      setSelectedPhotoIds([]);
      setIsSelectMode(false);
    } catch (err) {
      console.error("Batch delete failed:", err);
    }
  };

  const copyToClipboard = async (text, message = "Link copied to clipboard!") => {
    try {
      await navigator.clipboard.writeText(text);
      alert(message);
    } catch (err) {
      alert(message);
    }
  };

  const downloadSinglePhoto = async (photo) => {
    if (!photo || !photo.originalUrl) return;
    const filename = photo.filename || 'photo.jpg';
    
    try {
      const response = await fetch(photo.originalUrl);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    } catch (err) {
      console.warn("Direct blob fetch failed, falling back to download proxy:", err);
    }

    const proxyUrl = `https://us-east1-avma-photo-hub-2026.cloudfunctions.net/downloadPhoto?url=${encodeURIComponent(photo.originalUrl)}&filename=${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = proxyUrl;
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeletePhoto = async (photo) => {
    if (!window.confirm("Move this photo to the Trash Bin?")) return;
    setSelectedPhoto(null);
    setSearchParams({});
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        status: 'deleted',
        deletedAt: new Date()
      });
    } catch (err) {
      console.error("Move to trash failed:", err);
    }
  };

  const handleAddTag = async (photo, e) => {
    e.preventDefault();
    const input = e.target.elements.newTag;
    const tag = input.value.trim().toLowerCase();
    if (!tag) return;
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        tags: arrayUnion(tag)
      });
      setSelectedPhoto(prev => ({
        ...prev,
        tags: [...(prev.tags || []), tag]
      }));
      input.value = '';
    } catch (err) {
      console.error("Failed to add tag:", err);
    }
  };

  const handleRemoveTag = async (photo, tagToRemove) => {
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        tags: arrayRemove(tagToRemove)
      });
      setSelectedPhoto(prev => ({
        ...prev,
        tags: (prev.tags || []).filter(t => t !== tagToRemove)
      }));
    } catch (err) {
      console.error("Failed to remove tag:", err);
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
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header Title & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-dark)' }}>
              All Photos Gallery
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Showing {filteredPhotos.length} photo assets across your workspace
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Tag Filter Dropdown Select */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <Filter size={16} color="var(--primary)" />
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-dark)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none',
                  paddingRight: '4px'
                }}
              >
                <option value="All">All Category Tags ({photos.length})</option>
                {allUniqueTags.map(tag => (
                  <option key={tag.name} value={tag.name}>
                    {tag.name} ({tag.count})
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
              <button 
                onClick={() => setViewMode('grid')}
                style={{ background: viewMode === 'grid' ? '#E8F0FE' : 'white', border: 'none', padding: '6px 10px', cursor: 'pointer', display: 'flex', color: viewMode === 'grid' ? 'var(--primary)' : 'var(--text-muted)' }}
                data-tooltip="Grid View"
              >
                <Grid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                style={{ background: viewMode === 'list' ? '#E8F0FE' : 'white', border: 'none', padding: '6px 10px', cursor: 'pointer', display: 'flex', color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)' }}
                data-tooltip="List View"
              >
                <List size={18} />
              </button>
            </div>

            {/* Select Mode Toggle */}
            <button 
              className="btn-secondary" 
              onClick={() => setIsSelectMode(!isSelectMode)}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              {isSelectMode ? 'Exit Selection' : 'Select Multiple'}
            </button>
          </div>
        </div>

        {/* Photos Grid Stream */}
        {filteredPhotos.length === 0 ? (
          <div className="glass" style={{ padding: '3rem', textAlign: 'center', borderRadius: '12px', color: 'var(--text-muted)' }}>
            No photos found matching your filter criteria.
          </div>
        ) : (
          <>
            <div className={viewMode === 'list' ? 'photo-list' : 'photo-grid'} style={viewMode === 'list' ? { display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '10px', background: 'white' } : {}}>
              {filteredPhotos.slice(0, visibleCount).map((photo, index) => {
                const isSelected = selectedPhotoIds.includes(photo.id);
                const sizeMB = photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown';
                const imageUrl = photo.thumbnailUrl || photo.originalUrl;
                
                if (viewMode === 'list') {
                  return (
                    <div 
                      key={photo.id}
                      onClick={(e) => handlePhotoClick(photo, e)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center',
                        padding: '12px',
                        borderBottom: '1px solid var(--border)', 
                        cursor: 'pointer', 
                        background: isSelected ? 'rgba(0, 97, 254, 0.05)' : 'white' 
                      }}
                    >
                      <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', background: '#eee', marginRight: '16px', flexShrink: 0 }}>
                        {imageUrl && <img src={imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1, fontWeight: 500, color: 'var(--text-dark)' }}>{photo.filename}</div>
                      <div style={{ width: '100px', color: 'var(--text-muted)' }}>{sizeMB}</div>
                      <div style={{ width: '220px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {photo.tags?.slice(0, 3).map(t => (
                          <span key={t} style={{ background: '#E8F0FE', color: 'var(--primary)', padding: '2px 6px', borderRadius: '8px', fontSize: '0.75rem' }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Grid View
                return (
                  <div 
                    key={photo.id}
                    className={`photo-card ${isSelected ? 'selected' : ''}`} 
                    onClick={(e) => handlePhotoClick(photo, e)}
                    style={{ 
                      position: 'relative',
                      outline: isSelected ? '2px solid var(--primary)' : 'none',
                      transform: isSelected ? 'scale(0.98)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {isSelectMode && (
                      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, background: 'white', borderRadius: '4px', padding: '2px', display: 'flex' }}>
                        <input type="checkbox" checked={isSelected} readOnly style={{ width: '16px', height: '16px' }} />
                      </div>
                    )}

                    {photo.isFavorite && (
                      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                        <Heart size={20} fill="#e91e63" color="#e91e63" />
                      </div>
                    )}

                    {imageUrl ? (
                      <img src={imageUrl} alt={photo.filename} loading={index < 12 ? "eager" : "lazy"} decoding="async" />
                    ) : (
                      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <FileImage size={32} />
                      </div>
                    )}

                    {photo.status === 'processing_ai' && (
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

            {filteredPhotos.length > visibleCount && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => setVisibleCount(prev => prev + 48)}
                  style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem' }}
                >
                  Load More Photos (Showing {Math.min(visibleCount, filteredPhotos.length)} of {filteredPhotos.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Batch Operations */}
      {isSelectMode && selectedPhotoIds.length > 0 && (
        <BatchOperations 
          selectedPhotoIds={selectedPhotoIds}
          setSelectedPhotoIds={setSelectedPhotoIds}
          setIsSelectMode={setIsSelectMode}
          onDelete={handleBatchDelete}
        />
      )}

      {selectedPhoto && (
        <PhotoDetailsModal 
          photo={selectedPhoto} 
          onClose={() => {
            setSelectedPhoto(null);
            setSearchParams({});
          }}
          onDownload={() => downloadSinglePhoto(selectedPhoto)}
          onDelete={() => handleDeletePhoto(selectedPhoto)}
          onAddTag={(e) => handleAddTag(selectedPhoto, e)}
          onRemoveTag={(t) => handleRemoveTag(selectedPhoto, t)}
          isTrashView={viewMode === 'trash'}
          onRestore={() => handleRestorePhoto(selectedPhoto)}
          onNext={handleNext}
          onPrev={handlePrev}
          hasNext={currentIndex < filteredPhotos.length - 1}
          hasPrev={currentIndex > 0}
          onToggleFavorite={handleToggleFavorite}
        />
      )}
    </div>
  );
}
