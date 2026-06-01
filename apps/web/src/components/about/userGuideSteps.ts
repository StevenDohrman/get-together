export interface UserGuideStep {
    step: string;
    title: string;
    description: string;
    route: string;
    routeLabel: string;
}

export const userGuideSteps: UserGuideStep[] = [
    {
        step: '01',
        title: 'Sign in with your UW email',
        description:
            'Create an account from the auth page. Authentication is handled by Supabase, so you can use your UW email or any other email you check regularly.',
        route: '/auth',
        routeLabel: 'Go to sign in',
    },
    {
        step: '02',
        title: 'Build your profile',
        description:
            'Add a display name, a short bio, a few photos, and rank the interests that actually represent how you want to spend your time around campus. Interest weights drive your match scores.',
        route: '/profile',
        routeLabel: 'Edit profile',
    },
    {
        step: '03',
        title: 'Post a group seeking',
        description:
            'From the dashboard, describe the kind of group you want: target group size plus the interests it should revolve around. You can post multiple seekings (one for your hiking crew, another for a study group).',
        route: '/dashboard',
        routeLabel: 'Open dashboard',
    },
    {
        step: '04',
        title: 'Discover and swipe',
        description:
            'Browse other UW students whose seekings and interests are compatible with yours. Swipe yes on the people you want to be in a group with — swipes are private until both sides say yes.',
        route: '/discover',
        routeLabel: 'Start discovering',
    },
    {
        step: '05',
        title: 'Accept formation invites',
        description:
            'When you and enough compatible people have mutually swiped yes, UConnect proposes a group and sends a formation invite to every member. The group only forms once everyone accepts.',
        route: '/dashboard',
        routeLabel: 'Review invites',
    },
    {
        step: '06',
        title: 'Plan together',
        description:
            'As soon as a proposal opens, a group chat opens with it. Once the group is formed, use the chat to propose events with a location and time, RSVP, and turn the match into a real meetup around UW.',
        route: '/groups',
        routeLabel: 'See your groups',
    },
];
