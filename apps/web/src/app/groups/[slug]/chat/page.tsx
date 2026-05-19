import GroupChatClient from '@/components/GroupChatClient';

export default async function GroupChatPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  return <GroupChatClient groupSlug={params.slug} />;
}
