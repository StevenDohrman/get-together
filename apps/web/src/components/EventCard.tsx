export interface EventCardProps {
    image: string;
    title: string;
    date: string;
    time: string;
    location?: string;
    eventType?: string;
    status?: 'You\'re going' | 'Interested' | 'Going';
    statusColor?: string;
}

export default function EventCard({
    image,
    title,
    date,
    time,
    location,
    eventType,
    status,
    statusColor = 'bg-purple-600',
}: EventCardProps) {
    return (
        <div className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors">
            {/* Event Image */}
            <div
                className="h-40 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl"
            >
                {image}
            </div>

            {/* Event Details */}
            <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                        <h3 className="font-semibold text-white text-lg">{title}</h3>
                        <p className="text-xs text-slate-400 mt-1">{eventType}</p>
                    </div>
                    {status && (
                        <span className={`${statusColor} text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ml-2`}>
                            {status}
                        </span>
                    )}
                </div>

                <div className="space-y-2 text-sm text-slate-300">
                    <p>📅 {date} · {time}</p>
                    {location && <p>📍 {location}</p>}
                </div>
            </div>
        </div>
    );
}
