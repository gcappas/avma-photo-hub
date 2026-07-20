const { onObjectFinalized } = require("firebase-functions/v2/storage");
const admin = require("firebase-admin");
const { GoogleGenAI, Type } = require("@google/genai");

admin.initializeApp();

// Initialize the Google Gen AI client
const ai = new GoogleGenAI({});

exports.analyzePhoto = onObjectFinalized({ 
  // bucket: "avma-photo-hub-2026.appspot.com", // Configure specific bucket if needed
  memory: "1GiB",
  timeoutSeconds: 300
}, async (event) => {
  const fileBucket = event.data.bucket;
  const filePath = event.data.name;
  const contentType = event.data.contentType;
  
  // Only process images in the photos/ directory
  if (!contentType.startsWith("image/") || !filePath.startsWith("photos/")) {
    return console.log("Not a new photo upload. Ignoring.");
  }

  console.log(`Analyzing new image uploaded at ${filePath}`);
  
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

    const result = JSON.parse(response.text());
    
    // Find the firestore document by storagePath
    const db = admin.firestore();
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
    const db = admin.firestore();
    const photosRef = db.collection("photos");
    const snapshot = await photosRef.where("storagePath", "==", filePath).limit(1).get();
    if (!snapshot.empty) {
      await photosRef.doc(snapshot.docs[0].id).update({
        status: 'error_ai'
      });
    }
  }
});
