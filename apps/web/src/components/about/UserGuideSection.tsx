import Link from 'next/link';
import { userGuideSteps } from './userGuideSteps';

export default function UserGuideSection() {
    return (
        <section className="border-t border-slate-800 bg-slate-900/30 py-20" id="user-guide">
            <div className="mx-auto max-w-6xl px-6">
                <div className="mb-12 max-w-2xl">
                    <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                        User guide
                    </p>
                    <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        How to use UConnect at UW
                    </h2>
                    <p className="mt-4 text-slate-400">
                        Six steps from sign-in to your first real meetup. Each step links straight
                        to where it happens in the app.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {userGuideSteps.map(step => (
                        <div
                            key={step.step}
                            className="relative flex flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
                        >
                            <span className="mb-3 block text-sm font-bold tracking-widest text-purple-400">
                                {step.step}
                            </span>
                            <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
                            <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-400">
                                {step.description}
                            </p>
                            <Link
                                href={step.route}
                                className="inline-flex items-center gap-1 text-sm font-semibold text-purple-400 transition-colors hover:text-purple-300"
                            >
                                {step.routeLabel} <span aria-hidden>→</span>
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
