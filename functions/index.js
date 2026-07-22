const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
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
      
      const crypto = require("crypto");
      const token = crypto.randomUUID();

      await newFile.save(outputBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            firebaseStorageDownloadTokens: token
          }
        }
      });
      
      // Construct standard Firebase Storage download URL
      const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${fileBucket}/o/${encodeURIComponent(newFilePath)}?alt=media&token=${token}`;
      
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

exports.cleanupTrash = onSchedule("every 24 hours", async (event) => {
  console.log("Starting scheduled cleanup of trash items older than 30 days...");
  const db = getFirestore();
  
  // Calculate timestamp representing exactly 30 days ago
  const thirtyDaysAgo = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );

  try {
    // 1. Fetch deleted photos older than 30 days
    const photosSnapshot = await db.collection("photos")
      .where("status", "==", "deleted")
      .where("deletedAt", "<=", thirtyDaysAgo)
      .get();

    console.log(`Found ${photosSnapshot.size} expired photos to delete.`);
    
    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket();

    for (const docSnap of photosSnapshot.docs) {
      const data = docSnap.data();
      console.log(`Deleting expired photo: ${data.filename} (${docSnap.id})`);
      
      // Delete from Storage
      if (data.storagePath) {
        const file = bucket.file(data.storagePath);
        await file.delete().catch((err) => {
          console.warn(`Could not delete storage file ${data.storagePath}:`, err.message);
        });
      }
      
      // Delete from Firestore
      await docSnap.ref.delete();
    }

    // 2. Fetch deleted folders older than 30 days
    const foldersSnapshot = await db.collection("folders")
      .where("status", "==", "deleted")
      .where("deletedAt", "<=", thirtyDaysAgo)
      .get();

    console.log(`Found ${foldersSnapshot.size} expired folders to delete.`);
    for (const docSnap of foldersSnapshot.docs) {
      console.log(`Deleting expired folder: ${docSnap.data().name} (${docSnap.id})`);
      await docSnap.ref.delete();
    }
    
    console.log("Scheduled cleanup completed successfully.");
  } catch (error) {
    console.error("Scheduled cleanup failed:", error);
  }
});

exports.downloadPhoto = onRequest({ cors: true, region: "us-east1" }, async (req, res) => {
  const photoUrl = req.query.url;
  const filename = req.query.filename || "photo.jpg";
  
  if (!photoUrl) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const fetchRes = await fetch(photoUrl);
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    
    res.setHeader("Content-Type", fetchRes.headers.get("content-type") || "image/jpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buffer);
  } catch (err) {
    console.error("Error in downloadPhoto proxy:", err);
    res.status(500).send("Download failed");
  }
});
