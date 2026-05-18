interface ActivityItemProps {
  primary: string;
  secondary?: string;
  time: string;
  avatarClassName: string;
  compact?: boolean;
}

export default function ActivityItem({
  primary,
  secondary,
  time,
  avatarClassName,
  compact = false,
}: ActivityItemProps) {
  const containerClasses = compact ? 'items-start gap-3' : 'items-center gap-4';
  const avatarClasses = compact ? 'mt-1 h-8 w-8' : 'h-10 w-10';
  const textClasses = compact ? 'text-sm' : 'text-base';

  return (
    <div className={`flex rounded-lg transition-colors hover:bg-slate-700 ${compact ? 'p-0' : 'p-4'} ${containerClasses}`}>
      <div className={`${avatarClasses} rounded-full ${avatarClassName}`} />
      <div className="flex-1">
        <p className={`text-white ${textClasses}`}>
          {secondary ? (
            <>
              <span className="font-semibold">{primary}</span> {secondary}
            </>
          ) : (
            primary
          )}
        </p>
        <p className="text-xs text-slate-400">{time}</p>
      </div>
    </div>
  );
}