'use client';

import Link from 'next/link';
import DashboardLayout from './DashboardLayout';
import SectionHeader from './SectionHeader';
import Loading from './Loading';
import ErrorMessage from './ErrorMessage';
import { useGroups } from '@/lib/hooks/useGroups';

export default function GroupsClient() {
  const { groups, loading, error } = useGroups();

  return (
    <DashboardLayout>
      <SectionHeader title="Groups" />

      {loading ? <Loading /> : null}
      {error ? <ErrorMessage message={error} /> : null}

      {!loading && !error ? (
        groups.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groups.map(group => (
              <Link
                key={group.id}
                href={group.chatPath}
                className="group rounded-lg border border-slate-800 bg-slate-900/50 p-6 transition-colors hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold text-white">
                      {group.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
                    Open chat
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-500">/{encodeURIComponent(group.slug)}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
            You are not a member of any groups yet.
          </div>
        )
      ) : null}
    </DashboardLayout>
  );
}
