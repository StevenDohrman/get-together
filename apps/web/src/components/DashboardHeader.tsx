'use client';

interface StatsCardProps {
    icon: string;
    label: string;
}

function StatsCard({ icon, label, value }: StatsCardProps) {
    return (
        <div className="flex items-center gap-4 bg-slate-800 rounded-lg p-6">
            <div className="text-3xl">{icon}</div>
            <div>
                <p className="text-slate-400 text-sm">{label}</p>
            </div>
        </div>
    );
}

export default function DashboardHeader() {
    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -z-10"></div>
                <h1 className="text-4xl font-bold mb-2">Good evening, Amanda! 👋</h1>
                <p className="text-purple-100 text-lg">Let's get you connected today.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard icon="👥" label="Groups" value={12} />
                <StatsCard icon="🔗" label="Connections" value={156} />
                <StatsCard icon="📅" label="Events" value={23} />
            </div>
        </div>
    );
}
