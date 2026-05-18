import Link from 'next/link';

interface SectionHeaderProps {
  title: string;
  href?: string;
  actionLabel?: string;
  className?: string;
}

export default function SectionHeader({
  title,
  href,
  actionLabel = 'See all →',
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`mb-6 flex items-center justify-between ${className}`}>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {href ? (
        <Link href={href} className="text-sm text-purple-400 transition-colors hover:text-purple-300">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}