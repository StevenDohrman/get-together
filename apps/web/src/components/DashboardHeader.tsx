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

function StatsCard({ icon, label, value }: DashboardStat) {
    return (
        <div className="flex items-center gap-4 rounded-lg bg-slate-800 p-6">
            <div className="text-3xl">{icon}</div>
            <div>
                <p className="text-sm text-slate-400">{label}</p>
                {value !== undefined ? <p className="text-2xl font-semibold text-white">{value}</p> : null}
            </div>
        </div>
    );
}

export default function DashboardHeader({ userName, intro, stats }: DashboardHeaderProps) {
    return (
        <div className="space-y-8">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 p-8 text-white">
                <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-purple-400 opacity-20 blur-3xl" />
                <h1 className="mb-2 text-4xl font-bold">Good evening, {userName}! 👋</h1>
                <p className="text-lg text-purple-100">{intro}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {stats.map((stat) => (
                    <StatsCard key={stat.label} icon={stat.icon} label={stat.label} />
                ))}
            </div>
        </div>
    );
}
