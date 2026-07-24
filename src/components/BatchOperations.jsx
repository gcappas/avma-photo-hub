import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Trash2, Folder, Tag, Layers, X } from 'lucide-react';

export default function BatchOperations({ 
  selectedPhotoIds, 
  setSelectedPhotoIds, 
  setIsSelectMode,
  onDelete 
}) {
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  
  const [allFoldersList, setAllFoldersList] = useState([]);
  const [collectionsList, setCollectionsList] = useState([]);
  const [newTag, setNewTag] = useState('');

  // Fetch Folders
  useEffect(() => {
    if (!showMoveModal) return;
    const fetchActiveFolders = async () => {
      try {
        const q = query(collection(db, 'folders'));
        const snap = await getDocs(q);
        const folderList = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(f => f.status !== 'deleted');
        setAllFoldersList(folderList);
      } catch (err) {
        console.error("Failed to load active folders:", err);
      }
    };
    fetchActiveFolders();
  }, [showMoveModal]);

  // Fetch Collections
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

  const handleBatchMove = async (folderId) => {
    try {
      const promises = selectedPhotoIds.map(id => 
        updateDoc(doc(db, 'photos', id), { folderId: folderId === 'root' ? null : folderId })
      );
      await Promise.all(promises);
      setShowMoveModal(false);
      setSelectedPhotoIds([]);
      setIsSelectMode(false);
    } catch (err) {
      console.error(err);
      alert('Failed to move photos');
    }
  };

  const handleBatchTag = async (e) => {
    e.preventDefault();
    const tag = newTag.trim().toLowerCase();
    if (!tag) return;
    try {
      const promises = selectedPhotoIds.map(id => 
        updateDoc(doc(db, 'photos', id), { tags: arrayUnion(tag) })
      );
      await Promise.all(promises);
      setNewTag('');
      setShowTagModal(false);
      setSelectedPhotoIds([]);
      setIsSelectMode(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add tag');
    }
  };

  const handleBatchCollection = async (collectionId) => {
    try {
      const promises = selectedPhotoIds.map(id => 
        updateDoc(doc(db, 'photos', id), { collections: arrayUnion(collectionId) })
      );
      await Promise.all(promises);
      setShowCollectionModal(false);
      setSelectedPhotoIds([]);
      setIsSelectMode(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add to collection');
    }
  };

  if (selectedPhotoIds.length === 0) return null;

  return (
    <>
      <div style={{
        position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
        padding: '12px 24px', borderRadius: '100px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1000,
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{selectedPhotoIds.length} Selected</span>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }}></div>
        
        <button className="icon-btn" onClick={() => setShowMoveModal(true)} data-tooltip="Move Selected">
          <Folder size={20} />
        </button>
        <button className="icon-btn" onClick={() => setShowCollectionModal(true)} data-tooltip="Add to Collection">
          <Layers size={20} />
        </button>
        <button className="icon-btn" onClick={() => setShowTagModal(true)} data-tooltip="Add Tag">
          <Tag size={20} />
        </button>
        
        <div style={{ width: 1, height: 24, background: 'var(--border)' }}></div>
        <button className="icon-btn" onClick={onDelete} style={{ color: '#e53935' }} data-tooltip="Move to Trash">
          <Trash2 size={20} />
        </button>
      </div>

      {/* Move Modal */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Move Selected Photos</h3>
              <button className="icon-btn" onClick={() => setShowMoveModal(false)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Select destination folder:</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1.5rem' }}>
              <div 
                onClick={() => handleBatchMove('root')}
                style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}
              >
                <Folder size={18} color="var(--primary)" /> Home (Root)
              </div>
              {allFoldersList.map(folder => (
                <div 
                  key={folder.id}
                  onClick={() => handleBatchMove(folder.id)}
                  style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <Folder size={18} color="var(--primary)" fill="rgba(0, 97, 254, 0.1)" /> {folder.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tag Modal */}
      {showTagModal && (
        <div className="modal-overlay" onClick={() => setShowTagModal(false)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Add Tags</h3>
              <button className="icon-btn" onClick={() => setShowTagModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleBatchTag}>
              <input 
                type="text" autoFocus
                placeholder="Tag (e.g. conference2026)" 
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}
              />
              <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center' }}>Add Tag to {selectedPhotoIds.length} Photos</button>
            </form>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {showCollectionModal && (
        <div className="modal-overlay" onClick={() => setShowCollectionModal(false)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>Add to Collection</h3>
              <button className="icon-btn" onClick={() => setShowCollectionModal(false)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Select collection:</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1.5rem' }}>
              {collectionsList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No collections exist yet. Go to the Collections tab to create one.</div>
              ) : (
                collectionsList.map(col => (
                  <div 
                    key={col.id}
                    onClick={() => handleBatchCollection(col.id)}
                    style={{ padding: '10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                  >
                    <Layers size={18} color="var(--primary)" /> {col.name}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
