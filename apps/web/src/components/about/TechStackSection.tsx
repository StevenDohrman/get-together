import { techStack } from './techStack';

export default function TechStackSection() {
    return (
        <section className="border-y border-slate-800 bg-slate-900/30 py-20">
            <div className="mx-auto max-w-6xl px-6">
                <div className="mb-12 max-w-2xl">
                    <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                        Tech stack
                    </p>
                    <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        What UConnect is built with
                    </h2>
                    <p className="mt-4 text-slate-400">
                        Each component below is what actually ships in this repository, with a short
                        note on the role it plays in the system.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {techStack.map(item => (
                        <div
                            key={item.name}
                            className="rounded-3xl border border-slate-700/80 bg-slate-900/40 p-6 transition-colors hover:border-purple-500/40"
                        >
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600/20 text-2xl">
                                    {item.icon}
                                </div>
                                <span className="text-xs font-semibold uppercase tracking-widest text-purple-400">
                                    {item.role}
                                </span>
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-white">{item.name}</h3>
                            <p className="text-sm leading-relaxed text-slate-400">
                                {item.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
