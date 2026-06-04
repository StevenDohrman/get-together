import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

export type ProfilePhoto = {
    id: string;
    url: string;
    position: number;
};

export type Profile = {
    supabaseUserId?: string;
    email?: string;
    appUserId?: string;
    username?: string | null;
    displayName?: string | null;
    bio?: string | null;
    photos?: ProfilePhoto[];
    savedLocation?: string | null;
};

function messageFromError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

export function useProfile() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiGet<Profile>('/profile');
            setProfile(data ?? null);
        } catch (err: unknown) {
            setError(messageFromError(err));
            setProfile(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return { profile, loading, error, refetch: fetchProfile } as const;
}
