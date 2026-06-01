export interface ArchitectureDiagram {
    id: string;
    title: string;
    description: string;
    chart: string;
    caption?: string;
}

const monorepoTopology = `flowchart LR
    Browser["Browser (UW user)"]
    Web["apps/web<br/>Next.js 16 + React 19"]
    Api["apps/api<br/>Fastify 5 API"]
    SbAuth["Supabase Auth"]
    SbRt["Supabase Realtime"]
    Db[("Postgres + pgvector<br/>(Supabase)")]
    DbPkg["packages/db<br/>Prisma schema + client"]
    Shared["packages/shared<br/>Shared types"]

    Browser -->|"HTTPS"| Web
    Browser -->|"Auth (JWT)"| SbAuth
    Browser -->|"Realtime WS"| SbRt
    Web -->|"fetch + Bearer JWT"| Api
    Api -->|"verify JWT"| SbAuth
    Api -->|"Prisma queries"| Db
    Api -->|"broadcast events"| SbRt
    DbPkg -.->|"generates client"| Api
    Shared -.->|"types"| Web
    Shared -.->|"types"| Api
`;

const discoveryPipeline = `flowchart TD
    User["Active user opens /discover"]
    Seekings["UserGroupSeeking<br/>(size + interests)"]
    Profile["UserInterest<br/>(weighted profile)"]
    Compat["Find users with<br/>compatible seekings<br/>(same size, overlapping interests)"]
    Fallback["Fallback: users sharing<br/>any profile interest"]
    Score["normalizedWeightedOverlap<br/>(weighted cosine similarity)"]
    Ranked["Ranked DiscoveryUserDto[]<br/>(matchScore, sharedInterestCount)"]
    Hydrate["Hydrate: photos, bio,<br/>coarse distance bucket"]

    User --> Seekings
    User --> Profile
    Seekings -->|"have seekings"| Compat
    Seekings -->|"no compatible hits"| Fallback
    Compat --> Score
    Fallback --> Score
    Profile --> Score
    Score --> Ranked
    Ranked --> Hydrate
`;

const groupFormationFlow = `flowchart TD
    Swipe["Mutual YES swipes<br/>between users"]
    Compatible["Compatible group seekings<br/>(same target size + interest overlap)"]
    Proposal["GroupFormationProposal<br/>(status: OPEN)"]
    Invites["GroupFormationInvite<br/>(one per member, PENDING)"]
    Chat["Proposal GroupChat<br/>opens for members"]
    Accept{"All invites<br/>ACCEPTED?"}
    Group["Group created<br/>(source: APP_FORMED)"]
    Events["Group plans events<br/>+ chats in /groups/[slug]"]

    Swipe --> Proposal
    Compatible --> Proposal
    Proposal --> Invites
    Invites --> Chat
    Invites --> Accept
    Accept -->|"yes"| Group
    Accept -->|"any declined"| Proposal
    Group --> Events
`;

const databaseSchema = `erDiagram
    User }o--o{ Interest : "ranks"
    User ||--o{ UserPhoto : "has"
    User ||--o| UserLocation : "located at"
    User ||--o{ UserGroupSeeking : "posts"
    User }o--o{ User : "swipes on"

    UserGroupSeeking }o--o{ Interest : "wants"
    UserGroupSeeking ||--o{ GroupFormationProposal : "may form"

    GroupFormationProposal }o--o{ User : "invites"
    GroupFormationProposal ||--o| Group : "fulfills into"

    Group }o--o{ User : "has members"
    Group }o--o{ Interest : "is about"
    Group ||--o{ Event : "hosts"
    Group ||--|| GroupChat : "has"

    GroupChat ||--o{ GroupChatMessage : "contains"
    Event }o--o{ User : "attended by"
    Event ||--o| GroupChatMessage : "announced by"

    Interest ||--o| InterestEmbedding : "embedded as"
    Interest }o--o{ Interest : "parent of"
`;

export const architectureDiagrams: ArchitectureDiagram[] = [
    {
        id: 'monorepo-topology',
        title: 'Monorepo and deployment topology',
        description:
            'UConnect is a pnpm-workspaces monorepo. The browser talks to a Next.js web app and directly to Supabase for Auth and Realtime, while a Fastify API owns the application data layer through Prisma against a Supabase-hosted Postgres database with pgvector. Shared TypeScript types live in packages/shared, and the generated Prisma client comes from packages/db.',
        chart: monorepoTopology,
        caption: 'How the web client, Fastify API, Prisma, and Supabase fit together at runtime.',
    },
    {
        id: 'discovery-pipeline',
        title: 'Discovery and matching pipeline',
        description:
            'Discovery prefers other users who already have compatible group seekings (same target group size and overlapping seeking interests). When that pool is empty, it falls back to anyone who shares at least one of your profile interests. Both paths feed into a weighted cosine similarity score (normalizedWeightedOverlap) and the top candidates are hydrated with photos, bio, and a coarse distance bucket before being returned.',
        chart: discoveryPipeline,
        caption: 'matchingDiscovery.ts ranks candidates using the scoring helpers in matchingScoring.ts.',
    },
    {
        id: 'group-formation',
        title: 'Group formation flow',
        description:
            'When mutual YES swipes line up with compatible group seekings, the API creates an OPEN GroupFormationProposal and issues one PENDING invite per member. A proposal-scoped GroupChat is opened immediately so members can talk. Once every invite is ACCEPTED, the proposal is fulfilled into a real Group (source: APP_FORMED), and the group can start scheduling events.',
        chart: groupFormationFlow,
        caption: 'groupFormation.ts coordinates proposals, invites, and the eventual Group creation.',
    },
    {
        id: 'database-schema',
        title: 'Database schema',
        description:
            'A high-level view of the core entities and how they relate. Users rank Interests, post group seekings, and swipe on other users. A seeking can produce a group formation proposal which, once everyone accepts, fulfills into a real Group. Groups have members, host Events, and own a GroupChat for messages — and individual interests carry a pgvector embedding for similarity search.',
        chart: databaseSchema,
        caption:
            'Entity-relationship overview of packages/db/prisma/schema.prisma. Many-to-many lines collapse the underlying join tables (UserInterest, GroupMember, EventAttendee, etc.) for readability.',
    },
];
