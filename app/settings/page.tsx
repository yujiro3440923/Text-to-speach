'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Sidebar } from '@/components/Sidebar';
import { Key, Save, Check, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Ideally fetching user's org. For prototype, we might find the first org linked?
      // Or just list organizations and let them pick if multiple (unlikely for now).

      const { data: orgData, error } = await supabase
        .from('organizations')
        .select('*')
        .limit(1)
        .single();

      if (orgData) {
        setOrgId(orgData.id);
        // Do not show full key for security? Or show it?
        // Usually we mask it. But for simple SaaS management, let's show it partially or placeholder.
        setApiKey(orgData.google_api_key || '');
      }

      setLoading(false);
    };
    fetchSettings();
  }, [supabase]);

  const handleSave = async () => {
    if (!orgId) {
      toast.error('組織情報が見つかりません');
      return;
    }
    setSaving(true);

    const { error } = await supabase
      .from('organizations')
      .update({ google_api_key: apiKey })
      .eq('id', orgId);

    if (error) {
      toast.error('保存に失敗しました');
    } else {
      toast.success('APIキーを更新しました');
    }
    setSaving(false);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <SettingsIcon size={28} className="text-gray-400" />
          設定
        </h1>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm max-w-2xl overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Key size={18} /> Google Cloud API Key
            </h3>
          </div>
          <div className="p-8 space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                API Key
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Google Cloud Consoleから取得したAPIキーを入力してください。<br />
                ※ Text-to-Speech APIが有効化されている必要があります。
              </p>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                placeholder="AIzA..."
              />
            </div>

            <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div>
                <strong>推奨設定:</strong><br />
                本番環境(Vercel)では、セキュリティのため、この画面で設定するよりもVercelの環境変数 (Environment Variables) への設定を推奨します。
                ここでの設定はデモやローカル開発用として機能します。
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                キーを保存
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}