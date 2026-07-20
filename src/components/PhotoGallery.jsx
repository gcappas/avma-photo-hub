import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Download, Tag, Loader2 } from 'lucide-react';

export default function PhotoGallery() {
  const [photos, setPhotos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'photos'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPhotos(photosData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredPhotos = photos.filter(photo => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    // Search in filename
    if (photo.filename?.toLowerCase().includes(searchLower)) return true;
    
    // Search in AI generated tags/categories
    if (photo.tags && Array.isArray(photo.tags)) {
      return photo.tags.some(tag => tag.toLowerCase().includes(searchLower));
    }
    
    // Search in AI description
    if (photo.description?.toLowerCase().includes(searchLower)) return true;

    return false;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h3>Photo Library</h3>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="search" 
            placeholder="Search by tag, category, or name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 className="spinner" size={32} style={{ margin: '0 auto', animation: 'spin 2s linear infinite' }} />
          <p style={{ marginTop: '1rem' }}>Loading photos...</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <p>No photos found. {searchTerm ? "Try a different search term." : "Upload some photos above to get started!"}</p>
        </div>
      ) : (
        <div className="photo-grid">
          {filteredPhotos.map((photo) => (
            <div key={photo.id} className="photo-card glass">
              <div className="img-container">
                <img src={photo.originalUrl} alt={photo.filename} loading="lazy" />
                {photo.status === 'processing_ai' && (
                  <div className="ai-processing-overlay">
                    <Loader2 size={24} className="spinner" />
                    <span>AI Analyzing...</span>
                  </div>
                )}
                <div className="img-actions">
                  <a href={photo.originalUrl} target="_blank" rel="noopener noreferrer" className="btn" style={{ padding: '8px' }}>
                    <Download size={16} />
                  </a>
                </div>
              </div>
              <div className="photo-info">
                <p className="filename" title={photo.filename}>{photo.filename}</p>
                {photo.description && <p className="description">{photo.description}</p>}
                
                {photo.tags && photo.tags.length > 0 && (
                  <div className="tags-container">
                    <Tag size={12} color="var(--primary)" />
                    <div className="tags">
                      {photo.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                      {photo.tags.length > 5 && <span className="tag">+{photo.tags.length - 5}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        
        .photo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .photo-card {
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          flex-direction: column;
        }
        
        .photo-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px -8px rgba(0,0,0,0.15);
        }

        .img-container {
          position: relative;
          aspect-ratio: 4/3;
          overflow: hidden;
          background: rgba(0,0,0,0.05);
        }

        .img-container img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        
        .photo-card:hover .img-container img {
          transform: scale(1.05);
        }

        .ai-processing-overlay {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background: rgba(0,0,0,0.6);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 8px;
          backdrop-filter: blur(4px);
        }

        .img-actions {
          position: absolute;
          top: 10px;
          right: 10px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .photo-card:hover .img-actions {
          opacity: 1;
        }

        .photo-info {
          padding: 1rem;
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .filename {
          font-weight: 600;
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .description {
          font-size: 0.8rem;
          color: var(--text-muted);
          margin-bottom: 1rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .tags-container {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-top: auto;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .tag {
          font-size: 0.7rem;
          background: rgba(0, 119, 182, 0.1);
          color: var(--primary);
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
