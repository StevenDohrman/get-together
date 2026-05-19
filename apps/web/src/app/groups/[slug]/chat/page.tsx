import GroupChatClient from '@/components/GroupChatClient';

export default async function GroupChatPage(props: {
  params: { slug: string };
}) {
  return <GroupChatClient groupSlug={props.params.slug} />;
}
