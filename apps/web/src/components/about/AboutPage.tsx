import Link from 'next/link';
import Logo from '../Logo';
import AboutHero from './AboutHero';
import ProjectOverviewSection from './ProjectOverviewSection';
import TechStackSection from './TechStackSection';
import ArchitectureSection from './ArchitectureSection';
import UserGuideSection from './UserGuideSection';

export default function AboutPage() {
    return (
        <div className="min-h-full bg-slate-950 text-slate-100">
            <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/" className="transition-opacity hover:opacity-80">
                        <Logo />
                    </Link>
                </div>
            </header>

            <main>
                <AboutHero />
                <ProjectOverviewSection />
                <TechStackSection />
                <ArchitectureSection />
                <UserGuideSection />
            </main>

            <footer className="border-t border-slate-800 py-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
                    <Logo />
                </div>
            </footer>
        </div>
    );
}
