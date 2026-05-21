import GroupChatClient from '@/components/GroupChatClient';

export default async function GroupChatPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  return <GroupChatClient groupSlug={slug} />;
}
