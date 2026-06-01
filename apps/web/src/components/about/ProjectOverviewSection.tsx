const impactHighlights = [
    {
        icon: '🎯',
        title: 'Built around intent',
        description:
            'Every connection starts with a group seeking — a clear statement of the kind of group you want and the interests it should revolve around.',
    },
    {
        icon: '🧭',
        title: 'Lowers social friction',
        description:
            'Group-based matching is less awkward than reaching out one-on-one, which is exactly where transfer, commuter, international, and graduate students often get stuck.',
    },
    {
        icon: '🏛️',
        title: 'UW community impact',
        description:
            'Stronger peer belonging is linked to academic persistence and mental health outcomes. UConnect makes that easier to find at UW, especially outside immediate academic cohorts.',
    },
];

export default function ProjectOverviewSection() {
    return (
        <section className="mx-auto max-w-6xl px-6 pb-20">
            <div className="mx-auto max-w-3xl text-center">
                <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                    Project overview
                </p>
                <h2 className="mb-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    A focused way to find your people at UW
                </h2>
                <p className="text-lg leading-relaxed text-slate-400">
                    Even though tens of thousands of students are enrolled at the University of
                    Washington, social isolation is one of the most commonly reported barriers to
                    student wellbeing. Transfer students, international students, graduate students,
                    and commuters in particular often arrive without an established social network
                    and have few structured ways to build one outside of their immediate academic
                    cohort.
                </p>
                <p className="mt-4 text-lg leading-relaxed text-slate-400">
                    UConnect addresses that gap by giving UW students a structured way to find
                    others who share specific hobbies and activities, whether that is a weekly board
                    game group, a hiking crew, or a study group. Because the platform is designed
                    around small groups rather than one-on-one interactions, it reduces the social
                    friction that often prevents students from reaching out to strangers.
                </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {impactHighlights.map(item => (
                    <div
                        key={item.title}
                        className="rounded-3xl border border-slate-700/80 bg-slate-900/40 p-6 transition-colors hover:border-purple-500/40"
                    >
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-2xl">
                            {item.icon}
                        </div>
                        <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{item.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
