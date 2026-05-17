'use client';

import DashboardLayout from '@/components/DashboardLayout';

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Good evening, Amanda! 👋</h1>
        <p className="text-slate-400 mb-8">Let's get you connected today.</p>
        
        {/* Placeholder for dashboard content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-slate-800 rounded-lg p-6 h-40 flex items-center justify-center text-slate-400">
            Coming soon...
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
