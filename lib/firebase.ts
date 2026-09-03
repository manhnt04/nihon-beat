import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDBseWlQG56fdyiPjl8dMNLOmKDQEGGFKM',
  authDomain: 'vocalenglish-97fe1.firebaseapp.com',
  projectId: 'vocalenglish-97fe1',
  storageBucket: 'vocalenglish-97fe1.firebasestorage.app',
  messagingSenderId: '533358529829',
  appId: '1:533358529829:web:1855bb584a998a57319ecc',
  measurementId: 'G-DYGB3TNFBV',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);

if (typeof window !== 'undefined') {
  void isSupported().then((supported) => {
    if (supported) getAnalytics(firebaseApp);
  });
}
