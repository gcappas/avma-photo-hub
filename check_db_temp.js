import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC1Jo9eA9p70i5D-hp7c7PSUqsoNJanbPs",
  authDomain: "avma-photo-hub-2026.firebaseapp.com",
  projectId: "avma-photo-hub-2026",
  storageBucket: "avma-photo-hub-2026.firebasestorage.app",
  messagingSenderId: "127021636361",
  appId: "1:127021636361:web:bffc3e1c129b855367d1d8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  console.log("Fetching latest 5 photos...");
  const q = query(collection(db, "photos"), orderBy("uploadedAt", "desc"), limit(5));
  const snap = await getDocs(q);
  
  snap.forEach(doc => {
    console.log("-----------------------------------------");
    console.log("ID:", doc.id);
    const data = doc.data();
    console.log("Filename:", data.filename);
    console.log("Status:", data.status);
    console.log("ContentType:", data.contentType);
    console.log("StoragePath:", data.storagePath);
    console.log("OriginalUrl:", data.originalUrl);
    console.log("Tags:", data.tags);
  });
  console.log("-----------------------------------------");
}

run().catch(console.error);
