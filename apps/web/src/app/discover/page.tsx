import dynamic from 'next/dynamic';
const DiscoverClient = dynamic(() => import('@/components/DiscoverClient'), { ssr: false });

export default function DiscoverPage() {
    return <DiscoverClient />;
}
