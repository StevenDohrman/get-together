import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { DiscoveryInterest, DiscoveryPhoto } from './useDiscovery';

export type LikedUser = {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  photos: DiscoveryPhoto[];
  likedAt: string;
  interests: DiscoveryInterest[];
};

type LikedUsersResponse = { users: LikedUser[] };

export function useLikedUsers() {
  const [users, setUsers] = useState<LikedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLikedUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiGet<LikedUsersResponse>('/matching/liked');
      setUsers(resp.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load liked people');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLikedUsers();
  }, [fetchLikedUsers]);

  return { users, loading, error, refetch: fetchLikedUsers } as const;
}
