import { createContext } from 'react';
import type { User } from 'firebase/auth';

export type AuthContextValue = {
  user: User | null;
  nickname: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  checkNicknameAvailability: (nickname: string) => Promise<{ available: boolean; nickname: string }>;
  registerWithEmail: (params: {
    nickname: string;
    fullName?: string;
    email: string;
    password: string;
  }) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default AuthContext;
