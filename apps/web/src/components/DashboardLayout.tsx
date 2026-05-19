import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-slate-950">
            <Sidebar />
            <main className="flex flex-1 flex-col overflow-auto">
                <TopBar />
                <div className="flex-1 px-8 pb-12 pt-6">{children}</div>
            </main>
        </div>
    );
}
