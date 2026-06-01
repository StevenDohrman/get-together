import MermaidDiagram from './MermaidDiagram';
import { architectureDiagrams } from './architectureDiagrams';

export default function ArchitectureSection() {
    return (
        <section className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20" id="architecture">
            <div className="mb-12 max-w-2xl">
                <p className="mb-2 text-sm font-medium uppercase tracking-widest text-purple-400">
                    Architecture
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    How the system fits together
                </h2>
                <p className="mt-4 text-slate-400">
                    Four views of UConnect: the runtime topology, the matching pipeline that ranks
                    candidates, the group-formation flow that turns mutual swipes into a real
                    group, and the database schema that backs all of it.
                </p>
            </div>

            <div className="space-y-12">
                {architectureDiagrams.map(diagram => (
                    <article
                        key={diagram.id}
                        className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8"
                    >
                        <h3 className="mb-2 text-2xl font-semibold text-white">{diagram.title}</h3>
                        <p className="text-base leading-relaxed text-slate-400">
                            {diagram.description}
                        </p>
                        <MermaidDiagram
                            chart={diagram.chart}
                            caption={diagram.caption}
                            ariaLabel={diagram.title}
                        />
                    </article>
                ))}
            </div>
        </section>
    );
}
