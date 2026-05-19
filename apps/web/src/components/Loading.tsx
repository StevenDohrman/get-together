'use client';

export default function Loading({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-center gap-2 text-sm text-slate-300 ${className}`}>
            <div className="h-3 w-3 rounded-full animate-pulse bg-slate-400" />
            <span>Loading...</span>
        </div>
    );
}
