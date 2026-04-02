import { useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
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

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('Firebase Auth no esta configurado.');
    }

    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  };

  const registerWithEmail = async (params: {
    fullName: string;
    email: string;
    password: string;
  }): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('Firebase Auth no esta configurado.');
    }

    const displayName = params.fullName.trim();
    const credentials = await createUserWithEmailAndPassword(
      firebaseAuth,
      params.email.trim(),
      params.password,
    );

    if (displayName) {
      await updateProfile(credentials.user, {
        displayName,
      });
    }
  };

  const signOutUser = async (): Promise<void> => {
    if (!firebaseAuth) {
      return;
    }

    await signOut(firebaseAuth);
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
