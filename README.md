# AVMA Insurance Services Photo Hub

A high-performance, enterprise Digital Asset Management (DAM) platform built for **AVMA Insurance Services**. The application manages high-resolution marketing assets, event photography, iPhone HEIC images, custom tagging, SharePoint deep-linking, and automated AI image categorization powered by Google Gemini.

---

## 🌟 Key Features & User Workflows

### 📁 Folder-Enforced Uploads & Navigation
* **Upload Folder Enforcement:** Photos must belong to a folder. Dropping or browsing files opens an interactive modal to pick an existing folder or create a new one on the fly.
* **Recursive Breadcrumb Navigation:** Supports multi-level subfolder hierarchies with clickable breadcrumbs (`Home > Events > 2026`).
* **Multi-Select & Bulk Operations:** Batch select photos to move between folders, trigger parallel file downloads, or bulk delete.
* **Compact List vs. Grid View:** Layout toggle to switch between a rich visual grid and a compact list table with previews, file sizes, and metadata.

### 🏷️ AI Image Tagging & Custom Tags
* **Server-Side HEIC/HEIF Conversion:** Converts iPhone `.heic` and `.heif` uploads server-side using `heic-convert` inside Firebase Functions, producing web-compatible JPEGs automatically.
* **Google Gemini AI Categorization:** Automatically generates concise descriptions and extracts 3–8 category tags for every uploaded image.
* **Custom & Editable Tags:** Users can manually add custom tags or remove individual AI/custom tags directly in the photo details panel.

### 🔗 SharePoint & Deep-Linking Integration
* **Copy Folder Link:** One-click header button to copy clean folder URLs.
* **Copy Shareable Photo Link:** Generates URL deep links (`?photo=PHOTO_ID`). Opening the link automatically opens the parent folder and pops out the target photo's details panel.
* **Direct File Download Engine:** Dedicated backend proxy endpoint (`downloadPhoto`) that attaches `Content-Disposition: attachment; filename="..."` headers, forcing native browser save dialogs instead of opening images in tabs.

### 🗑️ 30-Day Trash Bin & Automated Purge
* **Accidental Delete Protection:** Deleting photos or folders moves them to the Trash Bin with a remaining expiration counter (e.g., `28 days left`).
* **Recursive Folder Trash & Restore:** Moving a folder to the trash recursively moves all nested subfolders and photos. Restoring brings the entire tree back intact.
* **Scheduled Cleanup (`cleanupTrash`):** Firebase 2nd Gen Scheduled Function runs every 24 hours to permanently delete Firestore documents and Cloud Storage blobs older than 30 days.

---

## 💰 Firebase Cost & Billing Guardrails

To prevent unexpected billing spikes on Google Cloud & Firebase:

1. **Scoped Firestore Queries:** Real-time listeners query only items matching the active folder (`where('folderId', '==', activeFolder)`).
2. **Hard Read Limits:** Global queries (`/all-photos`, search) apply `limit(150)` to cap read operations regardless of total asset count.
3. **Cloud Run Compute Caps (`maxInstances`):**
   * `analyzePhoto`: Capped at **max 5 instances** with a 90s timeout.
   * `downloadPhoto`: Capped at **max 10 instances** with a 30s timeout and 512MB RAM.
4. **Auth-Enforced Security Rules:** `firestore.rules` and `storage.rules` enforce `request.auth != null` to block unauthorized scrapers or bots from burning read bandwidth.
5. **Idempotent AI Triggers:** Checks if `status === 'ready'` before running Gemini API calls or writing updates, avoiding duplicate compute or API charges on retried events.

---

## 🎨 Brand Identity & Color Palette

The interface adheres to official **AVMA Insurance Services** brand guidelines:

* **Primary Dark (Midnight Blue):** `#00305E` (Sidebar background, primary headers)
* **Accent Call-to-Action (Limeade Green):** `#55B800` (Action buttons, active selection badges)
* **Secondary Highlight (Teal):** `#008B95` (Active navigation indicators)
* **Muted Text (Slate Grey):** `#5E6A71` (Subtitles, metadata)
* **Background Surface (Light Grey):** `#F7F8F8` (Main app workspace)

---

## 🛠️ Tech Stack & Architecture

* **Frontend:** React 19, Vite, React Router v7, Lucide Icons.
* **Authentication:** Firebase Auth (Microsoft OAuth Sign-In).
* **Database & Storage:** Cloud Firestore, Firebase Storage.
* **Backend:** Firebase Cloud Functions v2 (Node.js 22), `@google/genai` (Gemini 2.5 Flash), `heic-convert`, Cloud Scheduler.

---

## 🚀 Deployment Commands

```bash
# Build frontend locally
npm run build

# Deploy Cloud Functions, Security Rules, and Storage rules
npx firebase-tools deploy --only functions,firestore:rules,storage --force
```
