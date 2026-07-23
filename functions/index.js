const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { GoogleGenAI, Type } = require("@google/genai");

admin.initializeApp();



exports.analyzePhoto = onObjectFinalized({ 
  memory: "1GiB",
  timeoutSeconds: 120,
  maxInstances: 10
}, async (event) => {
  const fileBucket = event.data.bucket;
  const filePath = event.data.name;
  let contentType = event.data.contentType;
  
  const isHeic = filePath.toLowerCase().endsWith('.heic') || filePath.toLowerCase().endsWith('.heif') || (contentType && (contentType === 'image/heic' || contentType === 'image/heif'));
  const isImage = (contentType && contentType.startsWith("image/")) || isHeic;
  
  if (!isImage || !filePath.startsWith("photos/")) {
    return console.log("Not a new photo upload. Ignoring.");
  }

  const db = getFirestore();
  const photosRef = db.collection("photos");
  const { getStorage } = require("firebase-admin/storage");
  const bucket = getStorage().bucket(fileBucket);

  let activeFilePath = filePath;
  let activeContentType = contentType || 'image/jpeg';
  let activeDownloadURL = null;
  let activeFileSize = event.data.size;
  let newFilename = null;

  // Find corresponding Firestore document (checking original filePath OR converted JPEG filePath)
  const convertedJpgPath = filePath.replace(/\.(heic|heif)$/i, '.jpg');
  let snapshot = await photosRef.where("storagePath", "==", filePath).limit(1).get();
  if (snapshot.empty && isHeic) {
    snapshot = await photosRef.where("storagePath", "==", convertedJpgPath).limit(1).get();
  }

  if (snapshot.empty) {
    console.warn("No firestore document found for:", filePath);
    return;
  }

  const docId = snapshot.docs[0].id;
  const docData = snapshot.docs[0].data();

  // If document is already analyzed, skip redundant work
  if (docData.status === 'ready') {
    return console.log(`Photo ${filePath} (${docId}) is already analyzed and ready.`);
  }

  // Handle HEIC conversion inline
  if (isHeic) {
    console.log(`HEIC image detected. Converting ${filePath} to JPEG...`);
    try {
      const file = bucket.file(filePath);
      const [buffer] = await file.download();
      
      const convert = require("heic-convert");
      const outputBuffer = await convert({
        buffer: buffer,
        format: 'JPEG',
        quality: 0.92
      });
      
      activeFilePath = convertedJpgPath;
      activeContentType = 'image/jpeg';
      activeFileSize = outputBuffer.length;
      newFilename = docData.filename.replace(/\.(heic|heif)$/i, '.jpg');
      
      const newFile = bucket.file(activeFilePath);
      const crypto = require("crypto");
      const token = crypto.randomUUID();

      await newFile.save(outputBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: { firebaseStorageDownloadTokens: token }
        }
      });
      
      activeDownloadURL = `https://firebasestorage.googleapis.com/v0/b/${fileBucket}/o/${encodeURIComponent(activeFilePath)}?alt=media&token=${token}`;
      
      // Delete original HEIC
      await file.delete().catch(err => console.warn("Failed to delete original HEIC file:", err));
      console.log(`HEIC conversion finished successfully for ${docId}`);
    } catch (conversionErr) {
      console.error("HEIC conversion failed:", conversionErr);
      await photosRef.doc(docId).update({ status: 'error_ai' });
      return;
    }
  }

  // Run Gemini AI Analysis
  console.log(`Running Gemini AI analysis for photo ${docId} (${activeFilePath})...`);
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
            mimeType: activeContentType,
            fileUri: `gs://${fileBucket}/${activeFilePath}`
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

    const updateData = {
      description: result.description,
      tags: result.tags,
      status: 'ready'
    };

    if (activeDownloadURL) updateData.originalUrl = activeDownloadURL;
    if (activeFilePath !== filePath) updateData.storagePath = activeFilePath;
    if (newFilename) updateData.filename = newFilename;
    if (activeFileSize) updateData.size = activeFileSize;
    updateData.contentType = activeContentType;

    await photosRef.doc(docId).update(updateData);
    console.log(`Successfully analyzed and updated document ${docId}`);
  } catch (error) {
    console.error("Error analyzing image with AI:", error);
    await photosRef.doc(docId).update({ status: 'error_ai' });
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

exports.downloadPhoto = onRequest({ 
  cors: true, 
  region: "us-east1",
  memory: "512MiB",
  timeoutSeconds: 30,
  maxInstances: 10
}, async (req, res) => {
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

exports.repairStuckPhotos = onRequest({ cors: true, region: "us-east1" }, async (req, res) => {
  console.log("Starting repair of stuck photos...");
  const db = getFirestore();
  const photosRef = db.collection("photos");
  
  try {
    const snap = await photosRef.get();
    let repairedCount = 0;
    
    const ai = new GoogleGenAI({
      vertexai: true,
      project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "avma-photo-hub-2026",
      location: "us-east1"
    });

    const { getStorage } = require("firebase-admin/storage");
    const bucket = getStorage().bucket("avma-photo-hub-2026.firebasestorage.app");

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const needsRepair = data.status === 'processing_ai' || data.status === 'processing' || !data.tags || data.tags.length === 0;
      
      if (needsRepair && data.status !== 'deleted') {
        console.log(`Auto-repairing stuck photo ${docSnap.id} (${data.filename})...`);
        
        let targetFilePath = data.storagePath;
        let mimeType = data.contentType || 'image/jpeg';
        
        if (targetFilePath && (targetFilePath.toLowerCase().endsWith('.heic') || targetFilePath.toLowerCase().endsWith('.heif'))) {
          const file = bucket.file(targetFilePath);
          const [exists] = await file.exists();
          if (exists) {
            try {
              const [buffer] = await file.download();
              const convert = require("heic-convert");
              const outputBuffer = await convert({ buffer, format: 'JPEG', quality: 0.92 });
              const newFilePath = targetFilePath.replace(/\.(heic|heif)$/i, '.jpg');
              const newFile = bucket.file(newFilePath);
              const crypto = require("crypto");
              const token = crypto.randomUUID();
              await newFile.save(outputBuffer, { metadata: { contentType: 'image/jpeg', metadata: { firebaseStorageDownloadTokens: token } } });
              const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(newFilePath)}?alt=media&token=${token}`;
              targetFilePath = newFilePath;
              mimeType = 'image/jpeg';
              await file.delete().catch(() => {});
              await docSnap.ref.update({
                originalUrl: downloadURL,
                storagePath: newFilePath,
                filename: data.filename.replace(/\.(heic|heif)$/i, '.jpg'),
                contentType: 'image/jpeg'
              });
            } catch (e) {
              console.error("Repair HEIC error:", e);
            }
          } else {
            const jpgPath = targetFilePath.replace(/\.(heic|heif)$/i, '.jpg');
            const jpgFile = bucket.file(jpgPath);
            const [jpgExists] = await jpgFile.exists();
            if (jpgExists) {
              targetFilePath = jpgPath;
              mimeType = 'image/jpeg';
            }
          }
        }

        try {
          const aiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              "Analyze this image carefully. Provide a concise, engaging description (max 2 sentences) and extract 3-8 highly relevant category tags (e.g., 'dog', 'outdoor', 'event', 'health'). Return as JSON.",
              { fileData: { mimeType, fileUri: `gs://${bucket.name}/${targetFilePath}` } }
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

          const result = JSON.parse(aiResponse.text);
          await docSnap.ref.update({
            description: result.description,
            tags: result.tags,
            status: 'ready'
          });
          repairedCount++;
        } catch (aiErr) {
          console.error(`AI analysis failed for ${docSnap.id}:`, aiErr.message);
          await docSnap.ref.update({
            description: "Uploaded photo asset.",
            tags: ["photo", "asset"],
            status: 'ready'
          });
          repairedCount++;
        }
      }
    }

    res.send({ status: 'completed', repairedCount });
  } catch (err) {
    console.error("Auto repair error:", err);
    res.status(500).send({ error: err.message });
  }
});

// GET endpoint: Fetch current month AI Image Generation Usage & Quota (100 images / month limit)
exports.getAiUsage = onRequest({ cors: true, region: "us-east1" }, async (req, res) => {
  const db = getFirestore();
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  try {
    const usageDocRef = db.collection("ai_usage").doc(currentMonthKey);
    const usageSnap = await usageDocRef.get();
    
    let usedCount = 0;
    if (usageSnap.exists) {
      usedCount = usageSnap.data().count || 0;
    }

    res.send({
      success: true,
      month: currentMonthKey,
      usedThisMonth: usedCount,
      monthlyLimit: 100,
      remaining: Math.max(0, 100 - usedCount)
    });
  } catch (err) {
    console.error("Error fetching AI usage:", err);
    res.status(500).send({ error: err.message });
  }
});

// POST endpoint: Generate high-resolution image via Google Imagen 3 with 100 images/month quota
exports.generateAiImage = onRequest({ cors: true, region: "us-east1", timeoutSeconds: 120, memory: "1GiB" }, async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send({ error: 'Method not allowed. Use POST.' });
  }

  const { prompt, aspectRatio = '1:1', targetFolderId } = req.body || {};

  if (!prompt || !prompt.trim()) {
    return res.status(400).send({ error: 'A prompt description is required.' });
  }

  const db = getFirestore();
  const { FieldValue } = require("firebase-admin/firestore");
  const { getStorage } = require("firebase-admin/storage");
  const crypto = require("crypto");

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const MONTHLY_LIMIT = 100;

  try {
    // 1. Enforce 100 images / month quota
    const usageDocRef = db.collection("ai_usage").doc(currentMonthKey);
    const usageSnap = await usageDocRef.get();
    const currentCount = usageSnap.exists ? (usageSnap.data().count || 0) : 0;

    if (currentCount >= MONTHLY_LIMIT) {
      return res.status(429).send({
        error: `Monthly AI generation limit reached (${MONTHLY_LIMIT}/${MONTHLY_LIMIT} images used for ${currentMonthKey}). Limits reset on the 1st of next month.`,
        usedThisMonth: currentCount,
        monthlyLimit: MONTHLY_LIMIT
      });
    }

    // 2. Resolve destination folder (Default to system folder "AI Generated Photos")
    let folderId = targetFolderId || null;
    if (!folderId) {
      const foldersRef = db.collection("folders");
      const folderSnap = await foldersRef.where("name", "==", "AI Generated Photos").where("status", "!=", "deleted").limit(1).get();
      if (!folderSnap.empty) {
        folderId = folderSnap.docs[0].id;
      } else {
        // Create the system folder automatically
        const newFolderRef = await foldersRef.add({
          name: "AI Generated Photos",
          parentId: null,
          status: "active",
          createdAt: FieldValue.serverTimestamp()
        });
        folderId = newFolderRef.id;
        console.log(`Created system folder 'AI Generated Photos' (${folderId})`);
      }
    }

    // 3. Initialize Vertex AI client & call Imagen 3
    console.log(`Generating AI image for prompt: "${prompt}" (Aspect Ratio: ${aspectRatio})`);
    const ai = new GoogleGenAI({
      vertexai: true,
      project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "avma-photo-hub-2026",
      location: "us-east1"
    });

    let imageBytesBase64 = null;
    try {
      const aiResponse = await ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt.trim(),
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio
        }
      });

      if (aiResponse.generatedImages && aiResponse.generatedImages.length > 0) {
        imageBytesBase64 = aiResponse.generatedImages[0].image.imageBytes;
      }
    } catch (primaryErr) {
      console.warn("Imagen 3 primary model error, trying imagen-3.0-fast-generate-001 fallback:", primaryErr.message);
      const fallbackResponse = await ai.models.generateImages({
        model: 'imagen-3.0-fast-generate-001',
        prompt: prompt.trim(),
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio
        }
      });
      if (fallbackResponse.generatedImages && fallbackResponse.generatedImages.length > 0) {
        imageBytesBase64 = fallbackResponse.generatedImages[0].image.imageBytes;
      }
    }

    if (!imageBytesBase64) {
      throw new Error("No image data returned from Google Imagen 3 AI model.");
    }

    // 4. Save generated JPEG to Firebase Storage
    const imageBuffer = Buffer.from(imageBytesBase64, 'base64');
    const bucket = getStorage().bucket("avma-photo-hub-2026.firebasestorage.app");
    const photoId = `ai_gen_${crypto.randomUUID()}`;
    const storagePath = `photos/${photoId}.jpg`;
    const token = crypto.randomUUID();
    const storageFile = bucket.file(storagePath);

    await storageFile.save(imageBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: { firebaseStorageDownloadTokens: token }
      }
    });

    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
    const filename = `AI_Gen_${Date.now()}.jpg`;

    // 5. Create Firestore photo record
    const photoData = {
      filename,
      folderId,
      storagePath,
      originalUrl: downloadURL,
      contentType: 'image/jpeg',
      size: imageBuffer.length,
      description: `AI Generated: ${prompt.trim()}`,
      tags: ['ai-generated', 'imagen-3', 'studio'],
      status: 'ready',
      isAiGenerated: true,
      createdAt: FieldValue.serverTimestamp()
    };

    const photoDocRef = await db.collection("photos").add(photoData);

    // 6. Increment monthly usage counter atomically
    await usageDocRef.set({
      count: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp()
    }, { merge: true });

    const newCount = currentCount + 1;
    console.log(`Successfully generated AI photo ${photoDocRef.id}. Used ${newCount}/${MONTHLY_LIMIT} this month.`);

    res.send({
      success: true,
      photo: {
        id: photoDocRef.id,
        ...photoData,
        createdAt: new Date().toISOString()
      },
      usedThisMonth: newCount,
      monthlyLimit: MONTHLY_LIMIT,
      remaining: Math.max(0, MONTHLY_LIMIT - newCount)
    });

  } catch (err) {
    console.error("AI Image Generation failed:", err);
    res.status(500).send({ error: err.message || 'Image generation failed.' });
  }
});
