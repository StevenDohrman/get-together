import Link from 'next/link';
import Logo from './Logo';

const features = [
    {
        icon: '🎯',
        title: 'Define what you are looking for',
        description:
            'Post a group seeking with your ideal size and interest mix. Be clear about what kind of collaboration or community you want to build.',
    },
    {
        icon: '🔍',
        title: 'Discover compatible people',
        description:
            'Browse profiles matched by shared interests and compatible group seekings. Connect with people who want the same kind of group you do.',
    },
    {
        icon: '👥',
        title: 'Form focused groups',
        description:
            'Accept formation invites, spin up a group, and move from intent to action. Small groups built around shared goals, not endless scrolling.',
    },
    {
        icon: '📅',
        title: 'Meet and grow together',
        description:
            'Organize events, stay active in group chat, and turn online connections into real-world collaboration and community.',
    },
];

const steps = [
    {
        step: '01',
        title: 'Build your profile',
        description:
            'Add your display name, bio, and ranked interests so others understand what you care about and what you bring to a group.',
    },
    {
        step: '02',
        title: 'Share your group seeking',
        description:
            'Describe the kind of group you want: hobby circle, project team, local meetup, or professional network and who should join.',
    },
    {
        step: '03',
        title: 'Connect and form',
        description:
            'Discover compatible people, respond to formation invites, and launch a group when the right mix comes together.',
    },
    {
        step: '04',
        title: 'Show up consistently',
        description:
            'Use events and group chat to stay engaged. The best groups are built through regular, thoughtful participation.',
    },
];

const useCases = [
    {
        icon: '🛠️',
        title: 'Project collaborators',
        description: 'Find co-builders for side projects, startups, or creative work with aligned skills and availability.',
    },
    {
        icon: '📚',
        title: 'Learning circles',
        description: 'Join or start small study groups, book clubs, or skill-sharing communities around shared interests.',
    },
    {
        icon: '🤝',
        title: 'Professional networks',
        description: 'Connect with peers in your field for mentorship, referrals, and meaningful industry relationships.',
    },
    {
        icon: '📍',
        title: 'Local communities',
        description: 'Meet people nearby who share your hobbies from 3D printing to hiking and turn interests into regular meetups.',
    },
];

function FeatureCard({
    icon,
    title,
    description,
}: {
    icon: string;
    title: string;
    description: string;
}) {
    return (
        <div className="rounded-3xl border border-slate-700/80 bg-slate-900/40 p-6 transition-colors hover:border-purple-500/40">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-2xl">
                {icon}
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{description}</p>
        </div>
    );
}

function StepCard({
    step,
    title,
    description,
}: {
    step: string;
    title: string;
    description: string;
}) {
    return (
        <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <span className="mb-3 block text-sm font-bold tracking-widest text-purple-400">
                {step}
            </span>
            <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">{description}</p>
        </div>
    );
}

export default function LandingPage() {
    return (
        <div className="min-h-full bg-slate-950 text-slate-100">
            {/* Navigation */}
            <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <Link href="/" className="transition-opacity hover:opacity-80">
                        <Logo />
                    </Link>
                    <nav className="flex items-center gap-3">
                        <Link
                            href="/auth"
                            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:text-white sm:inline-block"
                        >
                            Sign in
                        </Link>
                        <Link
                            href="/auth"
                            className="rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                        >
                            Get started
                        </Link>
                    </nav>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-16">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-xl sm:p-12">
                        <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-orange-400 opacity-50 blur-3xl" />
                        <div className="pointer-events-none absolute right-0 top-12 h-72 w-72 rounded-full bg-pink-500 opacity-40 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-indigo-500 opacity-40 blur-3xl" />

                        <div className="relative max-w-2xl">
                            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-purple-200/90">
                                Interest-based group matching
                            </p>
                            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                                Find your people. Build your group.
                            </h1>
                            <p className="mb-8 text-lg leading-relaxed text-purple-100">
                                UConnect helps you discover compatible people, form small
                                groups around shared interests, and grow meaningful
                                connections professionally and personally.
                            </p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <Link
                                    href="/auth"
                                    className="rounded-xl bg-white px-6 py-3 text-center text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
                                >
                                    Create your account
                                </Link>
                                <Link
                                    href="#how-it-works"
                                    className="rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                                >
                                    See how it works
                                </Link>
                            </div>
                        </div>

                        <div className="relative mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
                            {[
                                { icon: '👥', label: 'Small groups', value: 'Right-sized' },
                                { icon: '💬', label: 'Shared interests', value: 'Matched' },
                                { icon: '📅', label: 'Real meetups', value: 'In-person' },
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-xl backdrop-blur-sm">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold leading-none text-white">
                                            {item.value}
                                        </p>
                                        <p className="mt-1 text-xs uppercase tracking-wider text-purple-100/80">
                                            {item.label}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* What is UConnect */}
                <section className="mx-auto max-w-6xl px-6 pb-20">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                            About UConnect
                        </p>
                        <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            Networking that starts with intent, not noise
                        </h2>
                        <p className="text-lg leading-relaxed text-slate-400">
                            Most platforms optimize for engagement. UConnect optimizes for
                            alignment, matching you with people who share your interests
                            and want the same kind of group experience. Whether you are
                            building a professional network, a hobby community, or a project
                            team, you start by saying what you are looking for.
                        </p>
                    </div>
                </section>

                {/* Features */}
                <section className="border-y border-slate-800 bg-slate-900/30 py-20">
                    <div className="mx-auto max-w-6xl px-6">
                        <div className="mb-12 max-w-2xl">
                            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                                Why UConnect
                            </p>
                            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                Built for people who want more than a feed
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {features.map(feature => (
                                <FeatureCard key={feature.title} {...feature} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
                    <div className="mb-12 max-w-2xl">
                        <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                            How it works
                        </p>
                        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            From profile to group in four steps
                        </h2>
                        <p className="mt-4 text-slate-400">
                            UConnect is designed to be straightforward: define what you
                            want, find compatible people, form a group, and stay connected.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {steps.map(step => (
                            <StepCard key={step.step} {...step} />
                        ))}
                    </div>

                    <div className="mt-12 flex flex-col items-center gap-3 text-center">
                        <p className="text-sm text-slate-400">
                            Curious about how UConnect works under the hood?
                        </p>
                        <Link
                            href="/about"
                            className="inline-flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-600/10 px-6 py-3 text-sm font-semibold text-purple-200 transition-colors hover:border-purple-400/60 hover:bg-purple-600/20 hover:text-white"
                        >
                            Learn more <span aria-hidden>→</span>
                        </Link>
                    </div>
                </section>

                {/* Use cases */}
                <section className="border-t border-slate-800 bg-slate-900/30 py-20">
                    <div className="mx-auto max-w-6xl px-6">
                        <div className="mb-12 max-w-2xl">
                            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                                Use it your way
                            </p>
                            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                                Professional, personal, or both
                            </h2>
                            <p className="mt-4 text-slate-400">
                                Groups on UConnect can be as focused or as casual as you
                                need. Here are a few ways members use the platform.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                            {useCases.map(useCase => (
                                <FeatureCard key={useCase.title} {...useCase} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="mx-auto max-w-6xl px-6 pb-24">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-purple-700 to-pink-600 p-8 text-center text-white shadow-lg sm:p-12">
                        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-pink-400 opacity-30 blur-3xl" />
                        <div className="relative mx-auto max-w-xl">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-white/20 text-3xl">
                                👋
                            </div>
                            <h2 className="mb-3 text-3xl font-bold tracking-tight">
                                Ready to get connected?
                            </h2>
                            <p className="mb-8 text-purple-100">
                                Create your profile, rank your interests, and start
                                discovering people who are looking for the same kind of
                                group you are.
                            </p>
                            <Link
                                href="/auth"
                                className="inline-block rounded-xl bg-white px-8 py-3 text-sm font-semibold text-purple-600 transition-colors hover:bg-purple-50"
                            >
                                Get started for free
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 py-8">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
                    <Logo />
                </div>
            </footer>
        </div>
    );
}
