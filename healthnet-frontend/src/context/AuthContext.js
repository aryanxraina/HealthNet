import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  isFirebaseConfigured,
  watchAuthState,
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  resetPassword,
  signOutUser,
  updateDisplayName,
  reauthenticate,
  deleteAccount,
} from '../firebase';

const AuthContext = createContext(null);

// Keep only the fields the UI needs, as a fresh object so React re-renders when they change
const toProfile = (firebaseUser) =>
  firebaseUser
    ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        // e.g. ['password'] or ['google.com']; decides how Settings handles passwords and re-login
        providers: (firebaseUser.providerData || []).map((provider) => provider.providerId),
      }
    : null;

export const getDisplayName = (user) =>
  user?.displayName || user?.email?.split('@')[0] || 'there';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = watchAuthState((firebaseUser) => {
      setUser(toProfile(firebaseUser));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = useCallback(async (name, email, password) => {
    const firebaseUser = await signUpWithEmail(name, email, password);
    // The auth listener fires before the display name is saved, so refresh the profile here
    setUser(toProfile(firebaseUser));
  }, []);

  const updateName = useCallback(async (name) => {
    const firebaseUser = await updateDisplayName(name);
    setUser(toProfile(firebaseUser));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isConfigured: isFirebaseConfigured,
      signIn: signInWithEmail,
      signUp,
      signInWithGoogle,
      resetPassword,
      signOut: signOutUser,
      updateName,
      reauthenticate,
      deleteAccount,
    }),
    [user, loading, signUp, updateName]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
