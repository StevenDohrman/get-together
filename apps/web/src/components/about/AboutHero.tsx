export default function AboutHero() {
    return (
        <section className="mx-auto max-w-6xl px-6 pb-12 pt-12 sm:pt-16">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-700 to-pink-600 p-8 text-white shadow-xl sm:p-12">
                <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-orange-400 opacity-50 blur-3xl" />
                <div className="pointer-events-none absolute right-0 top-12 h-72 w-72 rounded-full bg-pink-500 opacity-40 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-indigo-500 opacity-40 blur-3xl" />

                <div className="relative max-w-3xl">
                    <p className="mb-3 text-sm font-medium uppercase tracking-widest text-purple-200/90">
                        About UConnect
                    </p>
                    <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
                        Interest-based groups, built for the UW community.
                    </h1>
                    <p className="text-lg leading-relaxed text-purple-100">
                        UConnect helps UW students find compatible people, form small groups around
                        shared interests, and turn online intent into real meetups on and around
                        campus. This page covers what the tool does, how it is built, and how to
                        use it.
                    </p>
                </div>
            </div>
        </section>
    );
}
