'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Calendar, Clock, FileAudio } from 'lucide-react';
import Link from 'next/link';

// 履歴データの型定義
type HistoryItem = {
  id: string;
  created_at: string;
  original_text: string;
  target_seconds: number;
  file_url: string;
};

export default function HistoryPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [histories, setHistories] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 画面が開かれた時にデータを取得
  useEffect(() => {
    const fetchHistories = async () => {
      const { data, error } = await supabase
        .from('histories')
        .select('*')
        .order('created_at', { ascending: false }); // 新しい順

      if (error) {
        console.error('Error fetching histories:', error);
      } else {
        setHistories(data || []);
      }
      setIsLoading(false);
    };

    fetchHistories();
  }, [supabase]);

  // 日付を見やすく変換する関数
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <FileAudio className="text-indigo-600" />
            生成履歴一覧
          </h1>
          <Link 
            href="/" 
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 bg-white py-2 px-4 rounded-md border border-indigo-200 shadow-sm transition-colors"
          >
            <ArrowLeft size={16} />
            作成画面に戻る
          </Link>
        </div>

        {/* コンテンツエリア */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              読み込み中...
            </div>
          ) : histories.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>まだ履歴がありません。</p>
              <p className="text-sm mt-2">ホーム画面から音声を生成するとここに表示されます。</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {histories.map((item) => (
                <li key={item.id} className="hover:bg-gray-50 transition-colors">
                  <div className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    {/* 左側: 情報 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center text-sm text-gray-500 mb-1 gap-4">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(item.created_at)}
                        </span>
                        <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                          <Clock size={12} />
                          {item.target_seconds}秒設定
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.original_text}
                      </p>
                    </div>

                    {/* 右側: プレイヤー */}
                    <div className="flex items-center gap-4">
                      {/* プレイヤー: audioタグを使う */}
                      <audio 
                        controls 
                        src={item.file_url} 
                        className="h-8 w-64"
                        preload="none"
                      />
                      <a 
                        href={item.file_url} 
                        download={`radio_history_${item.id}.mp3`}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        DL
                      </a>
                    </div>

                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </main>
  );
}