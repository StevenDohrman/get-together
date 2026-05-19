import React, { useState } from 'react';

type Filters = {
    location?: string;
    ageMin?: number | null;
    ageMax?: number | null;
    interests?: string[];
    onlineOnly?: boolean;
};

export default function DiscoverFilters({
    initial = {},
    onApply,
}: {
    initial?: Filters;
    onApply: (filters: Filters) => void;
}) {
    const [location, setLocation] = useState(initial.location ?? '');
    const [ageMin, setAgeMin] = useState<number | ''>(initial.ageMin ?? '');
    const [ageMax, setAgeMax] = useState<number | ''>(initial.ageMax ?? '');
    const [interests, setInterests] = useState((initial.interests ?? []).join(', '));
    const [onlineOnly, setOnlineOnly] = useState(initial.onlineOnly ?? false);

    const apply = () => {
        const parsed: Filters = {};
        if (location.trim()) parsed.location = location.trim();
        if (ageMin !== '') parsed.ageMin = Number(ageMin) || 0;
        if (ageMax !== '') parsed.ageMax = Number(ageMax) || 0;
        const list = interests.split(',').map(s => s.trim()).filter(Boolean);
        if (list.length) parsed.interests = list;
        if (onlineOnly) parsed.onlineOnly = true;
        onApply(parsed);
    };

    const reset = () => {
        setLocation('');
        setAgeMin('');
        setAgeMax('');
        setInterests('');
        setOnlineOnly(false);
        onApply({});
    };

    return (
        <div className="space-y-2 rounded bg-slate-800 p-3">
            <div className="flex gap-2">
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" className="flex-1 rounded bg-slate-700 px-2 py-1 text-sm text-white" />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={onlineOnly} onChange={e => setOnlineOnly(e.target.checked)} />
                    Online
                </label>
            </div>
            <div className="flex gap-2">
                <input value={ageMin as any} onChange={e => setAgeMin(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Min age" className="w-24 rounded bg-slate-700 px-2 py-1 text-sm text-white" />
                <input value={ageMax as any} onChange={e => setAgeMax(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Max age" className="w-24 rounded bg-slate-700 px-2 py-1 text-sm text-white" />
                <input value={interests} onChange={e => setInterests(e.target.value)} placeholder="Interests (comma)" className="flex-1 rounded bg-slate-700 px-2 py-1 text-sm text-white" />
            </div>
            <div className="flex gap-2">
                <button className="rounded bg-purple-600 px-3 py-1 text-sm text-white" onClick={apply}>Apply</button>
                <button className="rounded bg-slate-700 px-3 py-1 text-sm text-white" onClick={reset}>Reset</button>
            </div>
        </div>
    );
}
