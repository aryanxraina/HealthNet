// The only module that talks to the Firebase SDK. The rest of the app uses these
// wrappers, which keeps tests free of network calls (see src/__mocks__/firebase.js).
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  deleteUser,
} from 'firebase/auth';
import {
  initializeFirestore,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

// Values come from healthnet-frontend/.env.local (see .env.example)
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

// Without keys the app still runs; Firebase calls fail with a clear error code instead
const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
// Optional questionnaire answers may be undefined; skip them instead of failing the write
const db = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null;

const notConfigured = () => {
  const error = new Error('Firebase is not configured');
  error.code = 'app/not-configured';
  return Promise.reject(error);
};

// ---- Authentication ----

export const watchAuthState = (callback) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const signInWithEmail = (email, password) =>
  auth ? signInWithEmailAndPassword(auth, email, password) : notConfigured();

export const signUpWithEmail = async (name, email, password) => {
  if (!auth) {
    return notConfigured();
  }
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(user, { displayName: name });
  }
  return user;
};

export const signInWithGoogle = () =>
  auth ? signInWithPopup(auth, new GoogleAuthProvider()) : notConfigured();

export const resetPassword = (email) =>
  auth ? sendPasswordResetEmail(auth, email) : notConfigured();

export const signOutUser = () => (auth ? signOut(auth) : Promise.resolve());

export const updateDisplayName = async (name) => {
  if (!auth?.currentUser) {
    return notConfigured();
  }
  await updateProfile(auth.currentUser, { displayName: name });
  return auth.currentUser;
};

// Sent to the HealthNet API so it can check who is asking
export const getIdToken = () => (auth?.currentUser ? auth.currentUser.getIdToken() : notConfigured());

// Firebase requires a fresh sign-in before sensitive actions such as deleting the account.
// Email accounts confirm with their password; Google accounts confirm in a popup.
export const reauthenticate = (password) => {
  const user = auth?.currentUser;
  if (!user) {
    return notConfigured();
  }
  if (password) {
    return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  }
  return reauthenticateWithPopup(user, new GoogleAuthProvider());
};

export const deleteAccount = () => (auth?.currentUser ? deleteUser(auth.currentUser) : notConfigured());

// ---- Firestore: users/{uid}, users/{uid}/data/questionnaire, users/{uid}/results/latest, food and activity days ----

const userDoc = (uid) => doc(db, 'users', uid);
const questionnaireDoc = (uid) => doc(db, 'users', uid, 'data', 'questionnaire');
const resultsDoc = (uid) => doc(db, 'users', uid, 'results', 'latest');
// One document per day of food, keyed 'YYYY-MM-DD': { meals: { breakfast: [...], ... } }
const foodDays = (uid) => collection(db, 'users', uid, 'food');
// One document per day of wearable readings, keyed 'YYYY-MM-DD': { steps, restingHeartRate, sleepMinutes, source }
const activityDays = (uid) => collection(db, 'users', uid, 'activity');

export const loadUserData = async (uid) => {
  if (!db) {
    return notConfigured();
  }
  const [user, questionnaire, results] = await Promise.all([
    getDoc(userDoc(uid)),
    getDoc(questionnaireDoc(uid)),
    getDoc(resultsDoc(uid)),
  ]);
  return {
    settings: user.data()?.settings ?? {},
    answers: questionnaire.data()?.sections ?? {},
    results: results.exists() ? results.data() : null,
  };
};

// Replaces the whole settings object so removed keys don't linger
export const saveSettings = (uid, settings) =>
  db
    ? setDoc(userDoc(uid), { settings, updatedAt: serverTimestamp() }, { mergeFields: ['settings', 'updatedAt'] })
    : notConfigured();

// Replaces one section's answers and leaves the other sections untouched
export const saveSection = (uid, sectionId, answers) =>
  db
    ? setDoc(
        questionnaireDoc(uid),
        { sections: { [sectionId]: answers }, updatedAt: serverTimestamp() },
        { mergeFields: [`sections.${sectionId}`, 'updatedAt'] }
      )
    : notConfigured();

export const saveResults = (uid, results) =>
  db ? setDoc(resultsDoc(uid), { ...results, savedAt: serverTimestamp() }) : notConfigured();

export const loadFoodDay = async (uid, date) => {
  if (!db) {
    return notConfigured();
  }
  const day = await getDoc(doc(foodDays(uid), date));
  return day.data()?.meals ?? {};
};

export const saveFoodDay = (uid, date, meals) =>
  db ? setDoc(doc(foodDays(uid), date), { meals, updatedAt: serverTimestamp() }) : notConfigured();

// { 'YYYY-MM-DD': meals } for every logged day from `from` to `to` (inclusive)
export const loadFoodRange = async (uid, from, to) => {
  if (!db) {
    return notConfigured();
  }
  const snapshot = await getDocs(query(foodDays(uid), where(documentId(), '>=', from), where(documentId(), '<=', to)));
  return Object.fromEntries(snapshot.docs.map((day) => [day.id, day.data().meals ?? {}]));
};

// Saves synced daily summaries ([{ date, steps, restingHeartRate, sleepMinutes }]), replacing those days
export const saveActivityDays = async (uid, days, source) => {
  if (!db) {
    return notConfigured();
  }
  // Firestore batches hold up to 500 writes; a sync returns at most 90 days
  const batch = writeBatch(db);
  days.forEach(({ date, ...values }) => batch.set(doc(activityDays(uid), date), { ...values, source, updatedAt: serverTimestamp() }));
  await batch.commit();
};

// { 'YYYY-MM-DD': { steps, restingHeartRate, sleepMinutes, source } } from `from` to `to` (inclusive)
export const loadActivityRange = async (uid, from, to) => {
  if (!db) {
    return notConfigured();
  }
  const snapshot = await getDocs(query(activityDays(uid), where(documentId(), '>=', from), where(documentId(), '<=', to)));
  return Object.fromEntries(
    snapshot.docs.map((day) => {
      const { steps = null, restingHeartRate = null, sleepMinutes = null, source = null } = day.data();
      return [day.id, { steps, restingHeartRate, sleepMinutes, source }];
    })
  );
};

// Keep this list in sync with the documents above when new ones are added
export const deleteUserData = async (uid) => {
  if (!db) {
    return notConfigured();
  }
  const [food, activity] = await Promise.all([getDocs(foodDays(uid)), getDocs(activityDays(uid))]);
  await Promise.all([
    deleteDoc(questionnaireDoc(uid)),
    deleteDoc(resultsDoc(uid)),
    ...food.docs.map((day) => deleteDoc(day.ref)),
    ...activity.docs.map((day) => deleteDoc(day.ref)),
  ]);
  await deleteDoc(userDoc(uid));
};
