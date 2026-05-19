'use client';

export default function ErrorMessage({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <div className="text-sm text-red-400 bg-red-900/20 rounded px-3 py-2">
            {message}
        </div>
    );
}
