'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Sidebar } from '@/components/Sidebar';
import { Play, Download, Calendar, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function HistoryPage() {
  const [histories, setHistories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchHistory = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('histories')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setHistories(data);
      setLoading(false);
    };
    fetchHistory();
  }, [supabase]);

  const handlePlay = (url: string, id: string) => {
    const audio = new Audio(url);
    audio.play();
    setPlayingId(id);
    audio.onended = () => setPlayingId(null);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <HistoryIcon size={28} className="text-gray-400" />
          生成履歴
        </h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : histories.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
            <p className="mb-2">履歴がありません</p>
            <p className="text-sm">スタジオで音声を作成するとここに表示されます。</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {histories.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md flex items-center gap-1">
                      <Clock size={12} /> {item.target_seconds}秒
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar size={12} />
                      {format(new Date(item.created_at), 'yyyy/MM/dd HH:mm', { locale: ja })}
                    </span>
                  </div>
                  <p className="text-gray-900 font-medium line-clamp-2 text-sm">
                    {item.original_text}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handlePlay(item.file_url, item.id)}
                    className="p-3 rounded-full bg-gray-100 hover:bg-indigo-600 hover:text-white transition-colors text-gray-700"
                    title="再生"
                  >
                    <Play size={20} fill={playingId === item.id ? "currentColor" : "none"} />
                  </button>
                  <a
                    href={item.file_url}
                    download
                    className="p-3 rounded-full bg-gray-100 hover:bg-green-600 hover:text-white transition-colors text-gray-700"
                    title="ダウンロード"
                  >
                    <Download size={20} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function HistoryIcon({ size, className }: { size?: number, className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
      <path d="M3 3v9h9" />
      <path d="M12 7v5l4 2" />
    </svg>
  )
}