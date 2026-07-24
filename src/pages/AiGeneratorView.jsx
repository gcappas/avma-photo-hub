import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Sparkles, Wand2, Folder, Download, Image as ImageIcon, CheckCircle2, Loader2, ArrowRight, Info } from 'lucide-react';

export default function AiGeneratorView() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [targetFolderId, setTargetFolderId] = useState('');
  const [folders, setFolders] = useState([]);
  
  const [usage, setUsage] = useState({ usedThisMonth: 0, monthlyLimit: 100, remaining: 100 });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPhoto, setGeneratedPhoto] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Sample prompt suggestions
  const samplePrompts = [
    "A compassionate female veterinarian in a white coat kneeling beside a golden retriever dog in a modern clinic, both vet and dog clearly visible",
    "A friendly male veterinarian in blue scrubs holding a cute domestic cat in a clean bright veterinary clinic",
    "A cheerful veterinary team of doctors and vet assistants posing together with a happy dog in a modern medical lobby",
    "Close-up high quality photography of a domestic cat resting comfortably on a veterinary examination table"
  ];

  // Fetch active folders
  useEffect(() => {
    const q = query(collection(db, 'folders'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(f => f.status !== 'deleted');
      setFolders(list);

      // Default to "AI Generated Photos" folder if present
      const aiFolder = list.find(f => f.name === 'AI Generated Photos');
      if (aiFolder) {
        setTargetFolderId(aiFolder.id);
      }
    });
    return unsubscribe;
  }, []);

  // Fetch monthly usage stats
  const fetchUsageStats = async () => {
    try {
      const res = await fetch('https://us-east1-avma-photo-hub-2026.cloudfunctions.net/getAiUsage');
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (err) {
      console.warn("Could not fetch AI usage stats:", err);
    }
  };

  useEffect(() => {
    fetchUsageStats();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setErrorMsg('');
    setGeneratedPhoto(null);

    try {
      const res = await fetch('https://us-east1-avma-photo-hub-2026.cloudfunctions.net/generateAiImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          targetFolderId: targetFolderId || undefined
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate AI image.');
      }

      setGeneratedPhoto(data.photo);
      setUsage(prev => ({
        ...prev,
        usedThisMonth: data.usedThisMonth,
        remaining: data.remaining
      }));
    } catch (err) {
      console.error("AI Generation Error:", err);
      setErrorMsg(err.message || 'An unexpected error occurred during image generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPhoto = async (photo) => {
    if (!photo || !photo.originalUrl) return;
    const filename = photo.filename || 'ai_generated.jpg';
    try {
      const response = await fetch(photo.originalUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      window.open(photo.originalUrl, '_blank');
    }
  };

  const percentUsed = Math.min(100, Math.round((usage.usedThisMonth / usage.monthlyLimit) * 100));

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header Banner */}
      <div 
        className="glass" 
        style={{ 
          padding: '2.25rem', 
          borderRadius: '16px', 
          marginBottom: '2.5rem', 
          background: 'linear-gradient(135deg, #002244 0%, #00305E 50%, #004B91 100%)', 
          color: '#FFFFFF',
          boxShadow: '0 8px 32px rgba(0, 48, 94, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', background: 'rgba(85, 184, 0, 0.2)', color: '#76E01A', padding: '4px 12px', borderRadius: '20px', fontWeight: 700, fontSize: '0.85rem', border: '1px solid rgba(118, 224, 26, 0.4)' }}>
          <Sparkles size={16} /> Enterprise AI Generation Engine
        </div>
        <h2 style={{ fontSize: '1.85rem', margin: 0, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
          AVMA Photo Studio AI Generator
        </h2>
        <p style={{ margin: '0.5rem 0 0 0', color: '#E0F2FE', fontSize: '0.95rem', maxWidth: '680px', lineHeight: '1.5' }}>
          Generate custom, high-resolution marketing assets & imagery. All generated photos are automatically saved to your dedicated <strong>"AI Generated Photos"</strong> folder.
        </p>
      </div>

      {/* Grid Layout: Controls & Output */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem' }}>
        
        {/* Left Column: Generator Form & Quota Meter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Monthly Quota Meter Card */}
          <div className="glass" style={{ padding: '1.5rem', borderRadius: '14px', background: 'white', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wand2 size={16} color="var(--primary)" /> Monthly AI Quota
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: usage.remaining > 0 ? '#55B800' : '#ff4d4f' }}>
                {usage.usedThisMonth} / {usage.monthlyLimit} images used
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
              <div style={{ width: `${percentUsed}%`, height: '100%', background: percentUsed > 90 ? '#ff4d4f' : 'var(--primary)', transition: 'width 0.3s ease' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{usage.remaining} generations remaining</span>
              <span>Resets 1st of month</span>
            </div>
          </div>

          {/* Generator Form */}
          <form onSubmit={handleGenerate} className="glass" style={{ padding: '1.75rem', borderRadius: '14px', background: 'white', border: '1px solid var(--border)' }}>
            
            {/* Prompt Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                Image Description / Prompt <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the photo you want to generate in detail..."
                rows={4}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />

              {/* Sample Prompt Chips */}
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Try a sample prompt:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {samplePrompts.map((s, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setPrompt(s)}
                      style={{
                        background: '#F1F5F9',
                        border: '1px solid #E2E8F0',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        color: 'var(--text-dark)',
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      "{s.slice(0, 32)}..."
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Aspect Ratio Picker */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                Aspect Ratio
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { label: '1:1 Square', value: '1:1' },
                  { label: '16:9 Wide', value: '16:9' },
                  { label: '4:3 Standard', value: '4:3' },
                  { label: '9:16 Story', value: '9:16' }
                ].map(item => (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setAspectRatio(item.value)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: aspectRatio === item.value ? 'var(--primary)' : 'var(--border)',
                      background: aspectRatio === item.value ? '#E8F0FE' : 'white',
                      color: aspectRatio === item.value ? 'var(--primary)' : 'var(--text-dark)',
                      fontSize: '0.8rem',
                      fontWeight: aspectRatio === item.value ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Destination Folder Picker */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
                Save Destination Folder
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', background: '#F8FAFC' }}>
                <Folder size={18} color="var(--primary)" />
                <select
                  value={targetFolderId}
                  onChange={(e) => setTargetFolderId(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">AI Generated Photos (Default System Folder)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={16} /> {errorMsg}
              </div>
            )}

            {/* Generate Button */}
            <button
              type="submit"
              className="btn"
              disabled={isGenerating || usage.remaining <= 0}
              style={{
                width: '100%',
                justify: 'center',
                padding: '12px',
                fontSize: '0.95rem',
                fontWeight: 700,
                background: usage.remaining > 0 ? '#55B800' : '#cbd5e1',
                borderColor: usage.remaining > 0 ? '#55B800' : '#cbd5e1',
                cursor: isGenerating || usage.remaining <= 0 ? 'not-allowed' : 'pointer'
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="spinner" /> Generating with Imagen 3 AI...
                </>
              ) : (
                <>
                  <Wand2 size={18} /> Generate AI Photo Asset
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Output Preview */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="glass" style={{ padding: '1.75rem', borderRadius: '14px', background: 'white', border: '1px solid var(--border)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--text-dark)', fontWeight: 700 }}>
              AI Generation Preview
            </h3>

            {isGenerating ? (
              <div style={{ flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', borderRadius: '12px', border: '2px dashed var(--border)', padding: '2rem', textAlign: 'center' }}>
                <Loader2 size={40} className="spinner" color="var(--primary)" style={{ marginBottom: '1rem' }} />
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>Synthesizing Photo with Imagen 3...</h4>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '300px' }}>
                  Google's Imagen 3 AI is rendering your prompt in high-resolution JPEG format.
                </p>
              </div>
            ) : generatedPhoto ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem', border: '1px solid var(--border)', background: '#eee' }}>
                  <img 
                    src={generatedPhoto.originalUrl} 
                    alt="Generated Asset" 
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '480px', objectFit: 'contain' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#55B800', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <CheckCircle2 size={16} /> Saved to Photo Studio
                  </div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-dark)' }}>{generatedPhoto.filename}</h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {generatedPhoto.description}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    onClick={() => downloadPhoto(generatedPhoto)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Download size={16} /> Download Photo
                  </button>

                  <button
                    className="btn-secondary"
                    onClick={() => navigate('/all-photos')}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    View in All Photos <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC', borderRadius: '12px', border: '2px dashed var(--border)', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <ImageIcon size={48} style={{ opacity: 0.4, marginBottom: '1rem' }} />
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>Ready for Generation</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', maxWidth: '320px' }}>
                  Enter a prompt on the left and click <strong>Generate AI Photo Asset</strong>. Your new image will appear here and be stored in your DAM.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
