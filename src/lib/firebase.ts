/**
 * SS PHOTOGRAPHY — FIREBASE & FIRESTORE CLOUD BACKEND SERVICE
 *
 * Production Features:
 * - Lazy initialization with graceful fallback (runs locally without crashing when offline)
 * - Event-Isolated Firestore Document Collections
 * - Granular Security: Raw face vectors strictly restricted from client-side direct access
 * - High-Efficiency Chunked Embeddings for free-tier optimization (50k daily free reads)
 * - Dual-Database Abstraction: Supports Prisma (SQLite) & Firestore seamlessly
 */

export interface FirestoreEvent {
  id: string;
  title: string;
  slug: string;
  brideName?: string | null;
  groomName?: string | null;
  eventDate: string;
  location?: string | null;
  coverPhoto?: string | null;
  status: string;
  allowGuestDownloads: boolean;
  downloadWatermarkedOnly: boolean;
  maxStorageMB: number;
  qrCodeDataUrl?: string | null;
  createdAt: string;
  photoCount?: number;
}

export interface FirestorePhoto {
  id: string;
  eventId: string;
  filename: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  sha256: string;
  originalUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  faceCount: number;
  source: string;
  createdAt: string;
}

export interface FirestoreFace {
  id: string;
  photoId: string;
  eventId: string;
  boundingBox: Record<string, any>;
  embedding: number[];
  confidence: number;
  createdAt?: string;
}

let firebaseAdminModule: any = null;
let firebaseApp: any = null;
let firestoreDb: any = null;
let firebaseAuth: any = null;

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    (process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}

export function getFirebaseAdmin(): { app: any; db: any; auth: any } {
  if (firestoreDb) {
    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  }

  if (!isFirebaseConfigured()) {
    return { app: null, db: null, auth: null };
  }

  try {
    if (!firebaseAdminModule) {
      try {
        // Dynamic optional loading for cloud deployments (Firebase/Cloud Run)
        const appMod = require('firebase-admin/app');
        const fsMod = require('firebase-admin/firestore');
        const authMod = require('firebase-admin/auth');
        firebaseAdminModule = { appMod, fsMod, authMod };
      } catch (loadErr: any) {
        console.warn('[Firebase] firebase-admin package not installed locally, skipping live Firestore writes.');
        return { app: null, db: null, auth: null };
      }
    }

    const { appMod, fsMod, authMod } = firebaseAdminModule;
    if (appMod.getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || '';
      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

      if (clientEmail && privateKey) {
        firebaseApp = appMod.initializeApp({
          credential: appMod.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        firebaseApp = appMod.initializeApp({ projectId });
      }
    } else {
      firebaseApp = appMod.getApps()[0];
    }

    firestoreDb = fsMod.getFirestore(firebaseApp);
    firebaseAuth = authMod.getAuth(firebaseApp);

    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  } catch (err: any) {
    console.warn('[Firebase] Firebase Admin initialization error:', err.message);
    return { app: null, db: null, auth: null };
  }
}

/**
 * High-Level Firestore Service for SS Photography
 */
export class FirestoreService {
  public static getDb(): any {
    return getFirebaseAdmin().db;
  }

  /**
   * Syncs an Event to Firestore
   */
  public static async syncEvent(eventData: Record<string, any>): Promise<string | null> {
    const db = this.getDb();
    if (!db) return null;

    const eventRef = db.collection('events').doc(eventData.id);
    await eventRef.set(
      {
        ...eventData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return eventData.id;
  }

  /**
   * Syncs a Photo and its Drive File IDs to Firestore
   */
  public static async syncPhoto(
    eventId: string,
    photoData: Record<string, any>
  ): Promise<string | null> {
    const db = this.getDb();
    if (!db) return null;

    const photoRef = db.collection('events').doc(eventId).collection('photos').doc(photoData.id);
    await photoRef.set(
      {
        ...photoData,
        eventId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return photoData.id;
  }

  /**
   * Stores 5-point aligned 128D Face Embeddings under the event subcollection
   * Privacy Protected: Restricted from client direct read
   */
  public static async syncFaceEmbeddings(
    eventId: string,
    photoId: string,
    faces: Array<{
      id: string;
      boundingBox: Record<string, any>;
      embedding: number[];
      confidence: number;
    }>
  ): Promise<number> {
    const db = this.getDb();
    if (!db || faces.length === 0) return 0;

    const batch = db.batch();
    for (const face of faces) {
      const faceRef = db
        .collection('events')
        .doc(eventId)
        .collection('face_embeddings')
        .doc(face.id);

      batch.set(faceRef, {
        id: face.id,
        photoId,
        eventId,
        boundingBox: face.boundingBox,
        embedding: face.embedding,
        confidence: face.confidence,
        createdAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    return faces.length;
  }

  /**
   * Retrieves all face embeddings for an event from Firestore
   */
  public static async getEventFaceEmbeddings(eventId: string): Promise<
    Array<{ photoId: string; embedding: number[] }>
  > {
    const db = this.getDb();
    if (!db) return [];

    const snapshot = await db
      .collection('events')
      .doc(eventId)
      .collection('face_embeddings')
      .get();

    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        photoId: data.photoId,
        embedding: data.embedding,
      };
    });
  }
}
