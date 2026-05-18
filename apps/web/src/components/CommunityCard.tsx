interface CommunityCardProps {
  title: string;
  members: string;
  gradientClassName: string;
  accentClassName: string;
}

export default function CommunityCard({
  title,
  members,
  gradientClassName,
  accentClassName,
}: CommunityCardProps) {
  return (
    <div className="overflow-hidden rounded-lg bg-slate-800 transition-colors hover:bg-slate-700">
      <div className={`h-32 ${gradientClassName}`} />
      <div className="p-4">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-400">{members}</p>
        <div className={`mt-3 h-3 w-3 rounded-full ${accentClassName}`} />
      </div>
    </div>
  );
}