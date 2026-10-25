// Test double for src/firebase.js, enabled with jest.mock('./firebase').
// Uses plain functions rather than jest.fn because CRA's resetMocks option
// clears jest.fn implementations before every test.
let currentUser = null;
let listeners = [];
// In-memory stand-in for Firestore: uid -> { settings, answers, results }
let store = {};

export const isFirebaseConfigured = true;

export const __setMockUser = (user) => {
  currentUser = user;
  listeners.forEach((listener) => listener(user));
};

export const __resetMockStore = () => {
  store = {};
};

export const __getMockStore = () => store;

// ---- Authentication ----

export const watchAuthState = (callback) => {
  listeners.push(callback);
  callback(currentUser);
  return () => {
    listeners = listeners.filter((listener) => listener !== callback);
  };
};

export const signInWithEmail = async () => {};

export const signUpWithEmail = async (name, email) => ({
  uid: 'test-user',
  email,
  displayName: name,
  photoURL: null,
  providerData: [{ providerId: 'password' }],
});

export const signInWithGoogle = async () => {};

export const resetPassword = async () => {};

export const signOutUser = async () => {
  __setMockUser(null);
};

export const updateDisplayName = async (name) => {
  currentUser = { ...currentUser, displayName: name };
  return currentUser;
};

export const getIdToken = async () => 'test-token';

export const reauthenticate = async () => {};

export const deleteAccount = async () => {
  __setMockUser(null);
};

// ---- Firestore ----

export const loadUserData = async (uid) => ({
  settings: store[uid]?.settings ?? {},
  answers: store[uid]?.answers ?? {},
  results: store[uid]?.results ?? null,
});

export const saveSettings = async (uid, settings) => {
  store[uid] = { ...store[uid], settings };
};

export const saveSection = async (uid, sectionId, answers) => {
  store[uid] = { ...store[uid], answers: { ...store[uid]?.answers, [sectionId]: answers } };
};

export const saveResults = async (uid, results) => {
  store[uid] = { ...store[uid], results };
};

export const loadFoodDay = async (uid, date) => store[uid]?.food?.[date] ?? {};

export const saveFoodDay = async (uid, date, meals) => {
  store[uid] = { ...store[uid], food: { ...store[uid]?.food, [date]: meals } };
};

export const loadFoodRange = async (uid, from, to) =>
  Object.fromEntries(Object.entries(store[uid]?.food ?? {}).filter(([date]) => date >= from && date <= to));

export const saveActivityDays = async (uid, days, source) => {
  const activity = { ...store[uid]?.activity };
  days.forEach(({ date, ...values }) => {
    activity[date] = { ...values, source };
  });
  store[uid] = { ...store[uid], activity };
};

export const loadActivityRange = async (uid, from, to) =>
  Object.fromEntries(Object.entries(store[uid]?.activity ?? {}).filter(([date]) => date >= from && date <= to));

export const deleteUserData = async (uid) => {
  delete store[uid];
};
