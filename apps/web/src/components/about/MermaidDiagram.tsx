'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface MermaidDiagramProps {
    chart: string;
    caption?: string;
    ariaLabel?: string;
}

let mermaidInitialized = false;

async function ensureMermaid(): Promise<typeof import('mermaid').default> {
    const mod = await import('mermaid');
    const mermaid = mod.default;
    if (!mermaidInitialized) {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'dark',
            fontFamily:
                "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
            themeVariables: {
                primaryColor: '#7c3aed',
                primaryTextColor: '#f1f5f9',
                primaryBorderColor: '#a78bfa',
                lineColor: '#a78bfa',
                secondaryColor: '#1e293b',
                tertiaryColor: '#0f172a',
                background: '#0f172a',
                mainBkg: '#1e1b4b',
                clusterBkg: '#0f172a',
                edgeLabelBackground: '#0f172a',
                fontSize: '14px',
            },
            flowchart: {
                curve: 'basis',
                htmlLabels: true,
                padding: 16,
            },
        });
        mermaidInitialized = true;
    }
    return mermaid;
}

export default function MermaidDiagram({ chart, caption, ariaLabel }: MermaidDiagramProps) {
    const reactId = useId();
    const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [svg, setSvg] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const mermaid = await ensureMermaid();
                const result = await mermaid.render(renderId, chart);
                if (!cancelled) {
                    setSvg(result.svg);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to render diagram');
                    setSvg(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [chart, renderId]);

    return (
        <figure className="my-4">
            <div
                ref={containerRef}
                role="img"
                aria-label={ariaLabel ?? caption ?? 'Architecture diagram'}
                className="overflow-x-auto rounded-2xl border border-slate-700/80 bg-slate-900/40 p-6 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
            >
                {error ? (
                    <p className="text-sm text-rose-400">Diagram failed to render: {error}</p>
                ) : svg ? (
                    <div dangerouslySetInnerHTML={{ __html: svg }} />
                ) : (
                    <p className="text-sm text-slate-400">Loading diagram…</p>
                )}
            </div>
            {caption ? (
                <figcaption className="mt-3 text-center text-sm text-slate-400">{caption}</figcaption>
            ) : null}
        </figure>
    );
}
