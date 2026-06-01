import Sidebar from './Sidebar';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 flex overflow-hidden bg-slate-950">
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto px-8 pb-12 pt-6">{children}</div>
            </main>
        </div>
    );
}
