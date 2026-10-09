import { useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebaseAuth, firebaseFunctions, firestoreDb } from '../lib/firebase';
import AuthContext from './context';

const googleProvider = new GoogleAuthProvider();

type CheckNicknameAvailabilityRequest = {
  nickname: string;
};

type CheckNicknameAvailabilityResponse = {
  nickname: string;
  nicknameKey: string;
  available: boolean;
};

type ClaimNicknameRequest = {
  nickname: string;
  fullName?: string;
};

type ClaimNicknameResponse = {
  nickname: string;
  nicknameKey: string;
};

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => firebaseAuth !== null);

  useEffect(() => {
    if (!firebaseAuth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setNickname(nextUser?.displayName ?? null);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!firestoreDb || !user) {
      return;
    }

    const userRef = doc(firestoreDb, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        const data = snapshot.data() as { nickname?: string } | undefined;
        const nextNickname = data?.nickname?.trim() ?? '';
        setNickname(nextNickname || user.displayName || null);
      },
      () => {
        setNickname(user.displayName || null);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [user]);

  const requireFunctions = () => {
    if (!firebaseFunctions) {
      throw new Error('El servicio de apodos no esta configurado.');
    }

    return firebaseFunctions;
  };

  const checkNicknameAvailability = async (
    nicknameValue: string,
  ): Promise<{ available: boolean; nickname: string }> => {
    const callable = httpsCallable<
      CheckNicknameAvailabilityRequest,
      CheckNicknameAvailabilityResponse
    >(requireFunctions(), 'checkNicknameAvailability');

    const response = await callable({
      nickname: nicknameValue.trim(),
    });

    return {
      available: response.data.available,
      nickname: response.data.nickname,
    };
  };

  const signInWithGoogle = async (): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('El servicio de autenticacion no esta configurado.');
    }

    await signInWithPopup(firebaseAuth, googleProvider);
  };

  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('El servicio de autenticacion no esta configurado.');
    }

    await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  };

  const registerWithEmail = async (params: {
    nickname: string;
    fullName?: string;
    email: string;
    password: string;
  }): Promise<void> => {
    if (!firebaseAuth) {
      throw new Error('El servicio de autenticacion no esta configurado.');
    }

    const trimmedNickname = params.nickname.trim();
    const credentials = await createUserWithEmailAndPassword(
      firebaseAuth,
      params.email.trim(),
      params.password,
    );

    try {
      const callable = httpsCallable<ClaimNicknameRequest, ClaimNicknameResponse>(
        requireFunctions(),
        'claimNickname',
      );

      const response = await callable({
        nickname: trimmedNickname,
        fullName: params.fullName?.trim() ?? '',
      });

      await updateProfile(credentials.user, {
        displayName: response.data.nickname,
      });

      setNickname(response.data.nickname);
    } catch (error) {
      try {
        await deleteUser(credentials.user);
      } catch {
        // Si no se puede eliminar en este punto, dejamos propagar el error original.
      }

      throw error;
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
    nickname,
    loading,
    signInWithGoogle,
    signInWithEmail,
    checkNicknameAvailability,
    registerWithEmail,
    signOutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
