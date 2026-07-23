import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, limit, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, deleteObject } from 'firebase/storage';
import { FileImage, Grid, List, Download, Link2, Trash2, X, Plus, RotateCcw, Loader2, Sparkles, Filter } from 'lucide-react';

export default function AllPhotosView({ searchQuery }) {
  const [photos, setPhotos] = useState([]);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(48);

  const [searchParams, setSearchParams] = useSearchParams();
  const photoParam = searchParams.get('photo');
  const location = useLocation();

  // Reset pagination on navigation/search change
  useEffect(() => {
    setVisibleCount(48);
  }, [selectedCategory, searchQuery]);

  // Fetch photos
  useEffect(() => {
    const q = query(collection(db, 'photos'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.status !== 'deleted');
      setPhotos(list);
    });
    return unsubscribe;
  }, []);

  // Auto-open selected photo on load if URL deep link is provided
  useEffect(() => {
    if (photoParam && photos.length > 0) {
      const matched = photos.find(p => p.id === photoParam);
      if (matched) {
        setSelectedPhoto(matched);
      }
    }
  }, [photoParam, photos]);

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
        const hasCategory = photo.tags?.some(t => {
          const cleanT = t.trim().toLowerCase();
          return cleanT === cat || cleanT === cat + 's' || cleanT + 's' === cat;
        });
        if (!hasCategory) return false;
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
    });
  }, [photos, selectedCategory, searchQuery]);

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
    try {
      await updateDoc(doc(db, 'photos', photo.id), {
        status: 'deleted',
        deletedAt: new Date()
      });
      setSelectedPhoto(null);
      setSearchParams({});
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
        ) : viewMode === 'grid' ? (
          <>
            <div className="photo-grid">
              {filteredPhotos.slice(0, visibleCount).map(photo => {
                const isSelected = selectedPhotoIds.includes(photo.id);
                return (
                  <div 
                    key={photo.id} 
                    className={`photo-card ${isSelected ? 'selected' : ''}`} 
                    onClick={() => handlePhotoClick(photo)}
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

                    {photo.originalUrl ? (
                      <img src={photo.originalUrl} alt={photo.filename} loading="lazy" decoding="async" />
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
        ) : (
          /* List View */
          <>
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'white' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: '#F7F9FA', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px', width: '60px' }}>Preview</th>
                    <th style={{ padding: '12px' }}>Filename</th>
                    <th style={{ padding: '12px', width: '120px' }}>Size</th>
                    <th style={{ padding: '12px', width: '220px' }}>AI Category Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPhotos.slice(0, visibleCount).map(photo => {
                    const isSelected = selectedPhotoIds.includes(photo.id);
                    const sizeMB = photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown';
                    return (
                      <tr 
                        key={photo.id} 
                        onClick={() => handlePhotoClick(photo)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSelected ? 'rgba(0, 97, 254, 0.05)' : 'white' }}
                      >
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '4px', overflow: 'hidden', background: '#eee' }}>
                            {photo.originalUrl && <img src={photo.originalUrl} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 500, color: 'var(--text-dark)' }}>{photo.filename}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{sizeMB}</td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {photo.tags?.slice(0, 3).map(t => (
                              <span key={t} style={{ background: '#E8F0FE', color: 'var(--primary)', padding: '2px 6px', borderRadius: '8px', fontSize: '0.75rem' }}>{t}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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

      {/* Right Side Panel - Photo Details */}
      {selectedPhoto && (
        <div className="right-panel glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Photo Details</h3>
            <button onClick={() => { setSelectedPhoto(null); setSearchParams({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>
          
          <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem', background: '#eee' }}>
            {selectedPhoto.originalUrl && <img src={selectedPhoto.originalUrl} alt="Preview" style={{ width: '100%', display: 'block' }} />}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', wordBreak: 'break-all', fontSize: '1rem' }}>{selectedPhoto.filename}</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              Size: {selectedPhoto.size ? `${(selectedPhoto.size / (1024 * 1024)).toFixed(1)} MB` : 'Unknown'}
            </p>
          </div>

          {selectedPhoto.description && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>AI Description</h5>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4', background: '#f8f9fa', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {selectedPhoto.description}
              </p>
            </div>
          )}

          {/* Tags */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tags</h5>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {selectedPhoto.tags?.map(t => (
                <span key={t} className="tag-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {t}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(selectedPhoto, t)} />
                </span>
              ))}
            </div>

            <form onSubmit={e => handleAddTag(selectedPhoto, e)} style={{ display: 'flex', gap: '6px' }}>
              <input type="text" name="newTag" placeholder="Add tag..." style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)' }} />
              <button type="submit" className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}><Plus size={14} /></button>
            </form>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
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
            
            <button 
              className="btn" 
              style={{ width: '100%', justifyContent: 'center' }} 
              disabled={isDownloading}
              onClick={async () => {
                setIsDownloading(true);
                await downloadSinglePhoto(selectedPhoto);
                setIsDownloading(false);
              }}
            >
              {isDownloading ? <Loader2 size={16} className="spinner" /> : 'Download Original'}
            </button>

            <button 
              className="btn-secondary" 
              style={{ width: '100%', justifyContent: 'center', borderColor: '#ff4d4f', color: '#ff4d4f', gap: '8px' }} 
              onClick={() => handleDeletePhoto(selectedPhoto)}
            >
              <Trash2 size={16} /> Move to Trash
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
