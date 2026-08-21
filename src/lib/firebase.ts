import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  getDocFromServer,
  writeBatch
} from "firebase/firestore";
import firebaseConfigData from "../../firebase-applet-config.json";
import { 
  Siswa, 
  Mapel, 
  Jadwal, 
  LogAbsensi, 
  DataNilai, 
  JurnalAgenda, 
  SiswaBimbingan, 
  BimbinganWali, 
  Pengaturan 
} from "../types";

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Use the explicit firestoreDatabaseId if provisioned
export const firestore = getFirestore(
  app, 
  firebaseConfigData.firestoreDatabaseId || "(default)"
);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Collections references
export const COLLECTIONS = {
  SISWA: "data_siswa",
  MAPEL: "mapel",
  JADWAL: "jadwal",
  LOG_ABSENSI: "log_absensi",
  DATA_NILAI: "data_nilai",
  JURNAL_AGENDA: "jurnal_agenda",
  SISWA_BIMBINGAN: "siswa_bimbingan",
  BIMBINGAN_WALI: "bimbingan_wali",
  PENGATURAN: "pengaturan"
};

// Validate Connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(firestore, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("offline")) {
      console.warn("Firestore client operating in offline mode.");
    }
  }
}
testConnection();

// Generic Realtime Subscription with offline fallback
export function subscribeCollection<T>(collectionName: string, callback: (data: T[]) => void) {
  const colRef = collection(firestore, collectionName);
  return onSnapshot(
    colRef, 
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as unknown as T);
      });
      callback(items);
    },
    (error) => {
      console.warn(`Firestore subscription notice on ${collectionName}:`, error?.message || error);
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

// Single Document Save/Update
export async function saveDocument(collectionName: string, id: string, data: Record<string, any>) {
  try {
    const docRef = doc(firestore, collectionName, id);
    await setDoc(docRef, { ...data, updatedAt: Date.now() }, { merge: true });
  } catch (err: any) {
    console.error(`Error saving document in ${collectionName}:`, err);
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${id}`);
  }
}

// Single Document Delete
export async function deleteDocument(collectionName: string, id: string) {
  try {
    const docRef = doc(firestore, collectionName, id);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.error(`Error deleting document in ${collectionName}:`, err);
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
  }
}

// Batch Save Documents
export async function batchSaveDocuments(collectionName: string, items: Array<{ id: string; [key: string]: any }>) {
  if (!items || items.length === 0) return;
  try {
    const batch = writeBatch(firestore);
    items.forEach((item) => {
      const docRef = doc(firestore, collectionName, item.id);
      batch.set(docRef, { ...item, updatedAt: Date.now() }, { merge: true });
    });
    await batch.commit();
  } catch (err: any) {
    console.error(`Error batch saving documents in ${collectionName}:`, err);
    handleFirestoreError(err, OperationType.WRITE, collectionName);
  }
}

// Pengaturan special helper (Doc ID: "config")
export async function savePengaturan(config: Pengaturan) {
  try {
    const docRef = doc(firestore, COLLECTIONS.PENGATURAN, "config");
    await setDoc(docRef, { ...config, updatedAt: Date.now() }, { merge: true });
  } catch (err: any) {
    console.error("Error saving pengaturan:", err);
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PENGATURAN}/config`);
  }
}

export function subscribePengaturan(callback: (config: Pengaturan) => void) {
  const docRef = doc(firestore, COLLECTIONS.PENGATURAN, "config");
  return onSnapshot(
    docRef, 
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data() as Pengaturan);
      }
    },
    (error) => {
      console.warn("Firestore pengaturan subscription notice:", error?.message || error);
      handleFirestoreError(error, OperationType.GET, `${COLLECTIONS.PENGATURAN}/config`);
    }
  );
}

// Clear / Wipe All Collections in Database (Except Configuration)
export async function clearAllDatabaseCollections() {
  // Set flag in localStorage and Firestore so auto-seeder never re-populates on any device
  localStorage.setItem("edadmin_database_cleared", "true");

  try {
    const configDocRef = doc(firestore, COLLECTIONS.PENGATURAN, "config");
    await setDoc(configDocRef, { isDatabaseCleared: true, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.warn("Could not set isDatabaseCleared flag in pengaturan collection:", err);
  }

  const collectionsToClear = [
    COLLECTIONS.SISWA,
    COLLECTIONS.MAPEL,
    COLLECTIONS.JADWAL,
    COLLECTIONS.LOG_ABSENSI,
    COLLECTIONS.DATA_NILAI,
    COLLECTIONS.JURNAL_AGENDA,
    COLLECTIONS.SISWA_BIMBINGAN,
    COLLECTIONS.BIMBINGAN_WALI
  ];

  const errors: string[] = [];

  for (const colName of collectionsToClear) {
    try {
      const colRef = collection(firestore, colName);
      const snapshot = await getDocs(colRef);
      if (!snapshot.empty) {
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(firestore);
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();
        }
      }
    } catch (err: any) {
      console.error(`Error clearing collection ${colName}:`, err);
      errors.push(`${colName}: ${err?.message || err}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Sebagian koleksi gagal dihapus: ${errors.join(", ")}`);
  }
}
