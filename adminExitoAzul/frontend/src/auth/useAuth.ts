import { useContext } from 'react';
import AuthContext from './context';
import type { AuthContextValue } from './context';

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
};
