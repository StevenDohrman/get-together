import type { Metadata } from 'next';
import AboutPage from '@/components/about/AboutPage';

export const metadata: Metadata = {
    title: 'About UConnect — Project, architecture, and user guide',
    description:
        'Learn what UConnect is, how it is built, and how UW students can use it to find compatible people and form interest-based groups.',
};

export default function About() {
    return <AboutPage />;
}
