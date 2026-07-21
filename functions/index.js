const { onObjectFinalized } = require("firebase-functions/v2/storage");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { GoogleGenAI, Type } = require("@google/genai");

admin.initializeApp();



exports.analyzePhoto = onObjectFinalized({ 
  // bucket: "avma-photo-hub-2026.appspot.com", // Configure specific bucket if needed
  memory: "1GiB",
  timeoutSeconds: 300
}, async (event) => {
  const fileBucket = event.data.bucket;
  const filePath = event.data.name;
  const contentType = event.data.contentType;
  
  // Only process images in the photos/ directory
  const isHeic = filePath.toLowerCase().endsWith('.heic') || filePath.toLowerCase().endsWith('.heif') || (contentType && (contentType === 'image/heic' || contentType === 'image/heif'));
  const isImage = (contentType && contentType.startsWith("image/")) || isHeic;
  
  if (!isImage || !filePath.startsWith("photos/")) {
    return console.log("Not a new photo upload. Ignoring.");
  }

  // Handle HEIC/HEIF conversion server-side
  if (isHeic) {
    console.log(`HEIC image detected. Converting ${filePath} to JPEG...`);
    try {
      const { getStorage } = require("firebase-admin/storage");
      const bucket = getStorage().bucket(fileBucket);
      const file = bucket.file(filePath);
      
      const [buffer] = await file.download();
      
      const convert = require("heic-convert");
      const outputBuffer = await convert({
        buffer: buffer,
        format: 'JPEG',
        quality: 0.95
      });
      
      const newFilePath = filePath.replace(/\.(heic|heif)$/i, '.jpg');
      const newFile = bucket.file(newFilePath);
      
      await newFile.save(outputBuffer, {
        metadata: {
          contentType: 'image/jpeg'
        }
      });
      
      // Get a signed URL far in the future
      const [downloadURL] = await newFile.getSignedUrl({
        action: 'read',
        expires: '03-09-2491'
      });
      
      // Update the firestore document
      const db = getFirestore();
      const photosRef = db.collection("photos");
      const snapshot = await photosRef.where("storagePath", "==", filePath).limit(1).get();
      
      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        const newFilename = snapshot.docs[0].data().filename.replace(/\.(heic|heif)$/i, '.jpg');
        
        await photosRef.doc(docId).update({
          originalUrl: downloadURL,
          storagePath: newFilePath,
          contentType: 'image/jpeg',
          filename: newFilename,
          size: outputBuffer.length
        });
        console.log(`Updated Firestore document ${docId} with JPEG info`);
      } else {
        console.warn("No firestore document found for original HEIC file:", filePath);
      }
      
      // Delete original HEIC file
      await file.delete().catch(err => console.warn("Failed to delete original HEIC file:", err));
      console.log(`HEIC conversion finished successfully. Deleted ${filePath}.`);
      return;
    } catch (error) {
      console.error("HEIC conversion failed:", error);
      // Update document to error state
      const db = getFirestore();
      const photosRef = db.collection("photos");
      const snapshot = await photosRef.where("storagePath", "==", filePath).limit(1).get();
      if (!snapshot.empty) {
        await photosRef.doc(snapshot.docs[0].id).update({
          status: 'error_ai'
        });
      }
      return;
    }
  }

  console.log(`Analyzing new image uploaded at ${filePath}`);
  
  // Initialize the Google Gen AI client inside the function 
  // so it doesn't crash during local deployment analysis when credentials aren't present
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "avma-photo-hub-2026",
    location: "us-east1"
  });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        "Analyze this image carefully. Provide a concise, engaging description (max 2 sentences) and extract 3-8 highly relevant category tags (e.g., 'dog', 'outdoor', 'event', 'health'). Return as JSON.",
        {
          fileData: {
            mimeType: contentType,
            fileUri: `gs://${fileBucket}/${filePath}`
          }
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["description", "tags"]
        }
      }
    });

    const result = JSON.parse(response.text);
    
    // Find the firestore document by storagePath
    const db = getFirestore();
    const photosRef = db.collection("photos");
    const snapshot = await photosRef.where("storagePath", "==", filePath).limit(1).get();
    
    if (snapshot.empty) {
      console.error("No corresponding firestore document found for", filePath);
      return;
    }
    
    const docId = snapshot.docs[0].id;
    
    // Update the document with AI analysis
    await photosRef.doc(docId).update({
      description: result.description,
      tags: result.tags,
      status: 'ready'
    });
    
    console.log(`Successfully analyzed and updated document ${docId}`);
    
  } catch (error) {
    console.error("Error analyzing image with AI:", error);
    
    // Update document status to error so frontend knows it failed
    const db = getFirestore();
    const photosRef = db.collection("photos");
    const snapshot = await photosRef.where("storagePath", "==", filePath).limit(1).get();
    if (!snapshot.empty) {
      await photosRef.doc(snapshot.docs[0].id).update({
        status: 'error_ai'
      });
    }
  }
});
