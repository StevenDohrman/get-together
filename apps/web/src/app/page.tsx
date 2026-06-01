import type { Metadata } from 'next';
import LandingPage from '@/components/LandingPage';

export const metadata: Metadata = {
    title: 'UConnect — Find your people. Build your group.',
    description:
        'Discover compatible people, form small groups around shared interests, and grow meaningful connections — professionally and personally.',
};

export default function Home() {
    return <LandingPage />;
}
