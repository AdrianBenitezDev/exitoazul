import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import AuthContext from './context';

const googleProvider = new GoogleAuthProvider();

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(() => firebaseAuth !== null);

  useEffect(() => {
    if (!firebaseAuth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async (): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('Firebase Auth no esta configurado.');
    }

    await signInWithPopup(firebaseAuth, googleProvider);
  };

  const signOutUser = async (): Promise<void> => {
    if (!firebaseAuth) {
      return;
    }

    await signOut(firebaseAuth);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      signInWithGoogle,
      signOutUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
