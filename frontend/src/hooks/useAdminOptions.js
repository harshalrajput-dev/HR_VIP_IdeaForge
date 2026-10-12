import { useMemo } from 'react';

import api from '../services/api';
import { useApi } from './useApi';
import { CATEGORIES, DEVELOPED_BY_DEFAULT, IDEA_STATUSES } from '../utils/constants';

/**
 * GET /api/admin/options - the authoritative enum lists for the HR VIP panel.
 *
 * The static constants below are only a paint-before-the-fetch fallback, so the
 * dashboard never hard-codes a category/status/role list that the server could
 * disagree with.
 */

const ROLE_LABELS = Object.freeze({
  user: 'Standard user',
  hr_vip_employee: 'HR VIP employee',
  admin: 'Admin',
});

const FALLBACK = Object.freeze({
  categories: CATEGORIES,
  statuses: IDEA_STATUSES,
  roles: Object.keys(ROLE_LABELS),
  defaultDevelopedBy: DEVELOPED_BY_DEFAULT,
});

/** @returns {{ options: typeof FALLBACK, roleLabel: (role?: string) => string, loading: boolean, error: object|null }} */
export function useAdminOptions() {
  const { data, loading, error } = useApi(() => api.get('/admin/options'), [], { initialData: null });

  const options = useMemo(
    () => ({
      categories: data?.categories?.length ? data.categories : FALLBACK.categories,
      statuses: data?.statuses?.length ? data.statuses : FALLBACK.statuses,
      roles: data?.roles?.length ? data.roles : FALLBACK.roles,
      defaultDevelopedBy: data?.defaultDevelopedBy || FALLBACK.defaultDevelopedBy,
    }),
    [data]
  );

  const roleLabel = useMemo(
    () => (role) => ROLE_LABELS[role] || (role ? role.replace(/_/g, ' ') : 'Unknown role'),
    []
  );

  return { options, roleLabel, loading, error };
}

export { ROLE_LABELS };
