interface DashboardStat {
    icon: string;
    label: string;
    value?: string | number;
}

interface DashboardHeaderProps {
    userName: string;
    intro: string;
    stats: DashboardStat[];
}

function greetingForNow(): string {
    const hour = new Date().getHours();
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function HeroStat({ icon, label, value }: DashboardStat) {
    return (
        <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur-sm">
                {icon}
            </div>
            <div>
                <p className="text-2xl font-bold leading-none text-white">
                    {value ?? '—'}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wider text-purple-100/80">
                    {label}
                </p>
            </div>
        </div>
    );
}

export default function DashboardHeader({ userName, intro, stats }: DashboardHeaderProps) {
    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-xl">
            {/* Aurora blobs */}
            <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-orange-400 opacity-50 blur-3xl" />
            <div className="pointer-events-none absolute right-0 top-12 h-72 w-72 rounded-full bg-pink-500 opacity-40 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-indigo-500 opacity-40 blur-3xl" />

            <div className="relative">
                <h1 className="mb-2 text-4xl font-bold tracking-tight">
                    {greetingForNow()}, {userName}! <span aria-hidden>👋</span>
                </h1>
                <p className="text-lg text-purple-100">{intro}</p>

                {stats.length > 0 ? (
                    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                        {stats.map(stat => (
                            <HeroStat
                                key={stat.label}
                                icon={stat.icon}
                                label={stat.label}
                                value={stat.value}
                            />
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
