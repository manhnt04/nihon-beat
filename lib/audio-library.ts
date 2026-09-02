export type AudioTrack = {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  addedAt: number;
};

const DB_NAME = 'nihon-beat-audio';
const STORE_NAME = 'tracks';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAudioTracks(): Promise<AudioTrack[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, 'readonly')
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as AudioTrack[]).sort((a, b) => b.addedAt - a.addedAt),
      );
    request.onerror = () => reject(request.error);
  });
}

export async function saveAudioFiles(files: File[]): Promise<void> {
  const db = await openDatabase();
  await Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          transaction.objectStore(STORE_NAME).put({
            id: `${file.name}-${file.size}-${file.lastModified}`,
            name: file.name,
            type: file.type,
            blob: file,
            addedAt: Date.now(),
          } satisfies AudioTrack);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        }),
    ),
  );
}

export async function deleteAudioTrack(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
