import {httpsCallable} from 'firebase/functions';
import {firebaseFunctions} from '../../lib/firebase';
import type {
  AdminPaymentUsersPage,
  AdminUserCatalog,
  AdminUserEmail,
} from './admin.types';

type AdminListUserEmailsResponse = {
  users: AdminUserEmail[];
  total: number;
};

type AdminGetUserCatalogRequest = {
  email: string;
};

type AdminListPaymentsUsersRequest = {
  limit?: number;
  pageToken?: string;
};

const requireFunctions = () => {
  if (!firebaseFunctions) {
    throw new Error('Cloud Functions no esta configurado para el modulo admin.');
  }

  return firebaseFunctions;
};

export const fetchAdminUserEmails = async (): Promise<AdminUserEmail[]> => {
  const callable = httpsCallable<Record<string, never>, AdminListUserEmailsResponse>(
    requireFunctions(),
    'adminListUserEmails',
  );

  const response = await callable({});
  return response.data.users;
};

export const fetchAdminUserCatalog = async (
  email: string,
): Promise<AdminUserCatalog> => {
  const callable = httpsCallable<AdminGetUserCatalogRequest, AdminUserCatalog>(
    requireFunctions(),
    'adminGetUserCatalog',
  );

  const response = await callable({
    email: email.trim(),
  });

  return response.data;
};

export const fetchAdminPaymentsUsers = async (
  params: AdminListPaymentsUsersRequest,
): Promise<AdminPaymentUsersPage> => {
  const callable = httpsCallable<AdminListPaymentsUsersRequest, AdminPaymentUsersPage>(
    requireFunctions(),
    'adminListPaymentsUsers',
  );

  const response = await callable(params);
  return response.data;
};

