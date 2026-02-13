'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Wand2, History, Settings, LogOut, Radio } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export const Sidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleLogout = async () => {
        await supabase.auth.signOut();
        toast.info('ログアウトしました');
        router.replace('/login');
    };

    const menuItems = [
        { name: 'Studio', icon: <Wand2 size={20} />, path: '/' },
        { name: 'History', icon: <History size={20} />, path: '/history' },
        { name: 'Settings', icon: <Settings size={20} />, path: '/settings' },
    ];

    return (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 z-10 font-sans">
            <div className="p-6 border-b border-gray-100 flex items-center gap-2">
                <div className="bg-indigo-600 p-2 rounded-lg">
                    <Radio className="text-white" size={24} />
                </div>
                <div>
                    <h1 className="font-bold text-xl text-gray-900 tracking-tight">Radio SaaS</h1>
                    <p className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">Broadcast Grade</p>
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${isActive
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            {item.icon}
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                    <LogOut size={20} />
                    Sign Out
                </button>
            </div>
        </aside>
    );
};
