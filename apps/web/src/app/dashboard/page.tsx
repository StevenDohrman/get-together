'use client';

import DashboardLayout from '@/components/DashboardLayout';
import DashboardHeader from '@/components/DashboardHeader';
import EventCard from '@/components/EventCard';
import Link from 'next/link';

export default function Dashboard() {
    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto">
                {/* Header and Stats */}
                <DashboardHeader />

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
                    {/* Left Column - Main Content */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Upcoming Events Section */}
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white">Upcoming Events</h2>
                                <Link href="/events" className="text-purple-400 hover:text-purple-300 text-sm">
                                    See all →
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <EventCard
                                    image="🎮"
                                    title="Game Night Live"
                                    date="Fri, Aug 23"
                                    time="7:00 PM"
                                    eventType="Virtual Event"
                                    status="You're going"
                                    statusColor="bg-purple-600"
                                />
                                <EventCard
                                    image="🌅"
                                    title="Sunset Hike"
                                    date="Sun, Aug 25"
                                    time="6:30 PM"
                                    location="Runyon Canyon"
                                    status="Going"
                                    statusColor="bg-green-500"
                                />
                            </div>
                        </section>

                        {/* Your Communities Section */}
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white">Your Communities</h2>
                                <Link href="/communities" className="text-purple-400 hover:text-purple-300 text-sm">
                                    See all →
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Community Card */}
                                <div className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors">
                                    <div className="h-32 bg-gradient-to-br from-blue-500 to-indigo-600"></div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-white">Gaming & Nerd Culture</h3>
                                        <p className="text-sm text-slate-400 mt-2">28 members</p>
                                        <div className="mt-3 w-3 h-3 rounded-full bg-purple-500"></div>
                                    </div>
                                </div>

                                <div className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors">
                                    <div className="h-32 bg-gradient-to-br from-orange-500 to-yellow-600"></div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-white">Creative Studio</h3>
                                        <p className="text-sm text-slate-400 mt-2">16 members</p>
                                        <div className="mt-3 w-3 h-3 rounded-full bg-cyan-500"></div>
                                    </div>
                                </div>

                                <div className="bg-slate-800 rounded-lg overflow-hidden hover:bg-slate-700 transition-colors">
                                    <div className="h-32 bg-gradient-to-br from-green-500 to-emerald-600"></div>
                                    <div className="p-4">
                                        <h3 className="font-semibold text-white">Hiking Adventures</h3>
                                        <p className="text-sm text-slate-400 mt-2">32 members</p>
                                        <div className="mt-3 w-3 h-3 rounded-full bg-orange-500"></div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Recent Activity Section */}
                        <section>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white">Recent Activity</h2>
                                <Link href="/activity" className="text-purple-400 hover:text-purple-300 text-sm">
                                    See all →
                                </Link>
                            </div>
                            <div className="bg-slate-800 rounded-lg divide-y divide-slate-700">
                                {/* Activity Item */}
                                <div className="flex items-center gap-4 p-4 hover:bg-slate-700 transition-colors">
                                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full"></div>
                                    <div className="flex-1">
                                        <p className="text-white"><span className="font-semibold">You</span> joined Photography Circle</p>
                                        <p className="text-xs text-slate-400">2h ago</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4 hover:bg-slate-700 transition-colors">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full"></div>
                                    <div className="flex-1">
                                        <p className="text-white"><span className="font-semibold">You</span> RSVP'd to Game Night Live</p>
                                        <p className="text-xs text-slate-400">5h ago</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4 hover:bg-slate-700 transition-colors">
                                    <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full"></div>
                                    <div className="flex-1">
                                        <p className="text-white"><span className="font-semibold">Ethan Parker</span> joined Hiking Adventures</p>
                                        <p className="text-xs text-slate-400">1d ago</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-8">
                        {/* Upcoming Events (Right) */}
                        <section>
                            <h3 className="text-lg font-semibold text-white mb-4">Upcoming Events</h3>
                            <div className="space-y-4">
                                <EventCard
                                    image="🎮"
                                    title="Game Night Live"
                                    date="Fri, Aug 23"
                                    time="7:00 PM"
                                    eventType="Virtual Event"
                                    status="You're going"
                                    statusColor="bg-purple-600"
                                />
                                <EventCard
                                    image="🎨"
                                    title="Creative Workshop"
                                    date="Sat, Aug 24"
                                    time="2:00 PM"
                                    location="Downtown Studio"
                                    status="Interested"
                                    statusColor="bg-yellow-500"
                                />
                                <EventCard
                                    image="🌅"
                                    title="Sunset Hike"
                                    date="Sun, Aug 25"
                                    time="6:30 PM"
                                    location="Runyon Canyon"
                                    status="Going"
                                    statusColor="bg-green-500"
                                />
                            </div>
                        </section>

                        {/* Recent Activity (Right) */}
                        <section>
                            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                            <div className="bg-slate-800 rounded-lg divide-y divide-slate-700 space-y-4 p-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full mt-1"></div>
                                    <div className="flex-1">
                                        <p className="text-sm text-white">Joined Photography Circle</p>
                                        <p className="text-xs text-slate-400">2h ago</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 pt-4">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mt-1"></div>
                                    <div className="flex-1">
                                        <p className="text-sm text-white">RSVP'd to Game Night Live</p>
                                        <p className="text-xs text-slate-400">5h ago</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 pt-4">
                                    <div className="w-8 h-8 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full mt-1"></div>
                                    <div className="flex-1">
                                        <p className="text-sm text-white">Ethan Parker joined Hiking Adventures</p>
                                        <p className="text-xs text-slate-400">1d ago</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* CTA Card */}
                        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg p-6 text-white">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-3xl">👥</span>
                            </div>
                            <h3 className="text-xl font-bold mb-2">Grow your network</h3>
                            <p className="text-purple-100 text-sm mb-4">Find people with similar interests and connect!</p>
                            <button className="w-full bg-white text-purple-600 font-semibold py-2 rounded-lg hover:bg-purple-50 transition-colors">
                                Find People
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
