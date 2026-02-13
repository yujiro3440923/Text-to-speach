'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Sidebar } from '@/components/Sidebar';
import { Key, Save, Check, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  /* State */
  const [apiKey, setApiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [fishKey, setFishKey] = useState('');

  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('1234'); // Default fallback, but should fetch from DB
  const [newPassword, setNewPassword] = useState('');

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

      const { data: orgData, error } = await supabase
        .from('organizations')
        .select('*')
        .limit(1)
        .single();

      if (orgData) {
        setOrgId(orgData.id);
        setApiKey(orgData.google_api_key || '');
        setOpenaiKey(orgData.openai_api_key || '');
        setFishKey(orgData.fish_api_key || '');
        if (orgData.settings_password) {
          setCurrentPassword(orgData.settings_password);
        }
      }
      setLoading(false);
    };
    fetchSettings();
  }, [supabase]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === currentPassword) {
      setIsAuthenticated(true);
      toast.success('認証成功');
    } else {
      toast.error('パスワードが違います');
    }
  };

  const handleSave = async () => {
    if (!orgId) {
      toast.error('組織情報が見つかりません');
      return;
    }
    setSaving(true);

    // Update object
    const updates: any = {
      google_api_key: apiKey,
      openai_api_key: openaiKey,
      fish_api_key: fishKey
    };

    if (newPassword && newPassword.length >= 4) {
      updates.settings_password = newPassword;
      setCurrentPassword(newPassword); // Update local state
    } else if (newPassword) {
      toast.warning('パスワードは4文字以上で設定してください（変更はスキップされました）');
    }

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId);

    if (error) {
      toast.error('保存に失敗しました');
    } else {
      toast.success('設定を更新しました');
      if (newPassword && newPassword.length >= 4) setNewPassword(''); // Clear new password field
    }
    setSaving(false);
  };

  if (!isAuthenticated && !loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 flex items-center justify-center">
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Key size={24} className="text-gray-400" />
              セキュリティ保護
            </h2>
            <form onSubmit={handleUnlock}>
              <p className="text-sm text-gray-600 mb-4">設定を変更するにはパスワードを入力してください。<br />(初期設定: 1234)</p>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-lg mb-6 focus:ring-2 focus:ring-indigo-500"
                placeholder="パスワード"
                autoFocus
              />
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">
                解除
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <SettingsIcon size={28} className="text-gray-400" />
          API 設定 & セキュリティ
        </h1>

        <div className="max-w-3xl space-y-8">

          {/* API Keys Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Key size={18} /> API Keys
              </h3>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Google Cloud API Key (Text-to-Speech)
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="AIzA..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  OpenAI API Key (GPT-4o)
                </label>
                <input
                  type="text"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="sk-..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Fish Audio API Key
                </label>
                <input
                  type="text"
                  value={fishKey}
                  onChange={(e) => setFishKey(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="Fish Audio API Key"
                />
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <SettingsIcon size={18} /> セキュリティ設定
              </h3>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  設定ページ用パスワードの変更
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  変更する場合のみ入力してください。
                </p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="新しいパスワード"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-10 rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 transform hover:scale-105"
            >
              {saving ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Save size={20} />}
              全設定を保存
            </button>
          </div>

          <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm flex items-start gap-3 mt-4">
            <AlertCircle size={20} className="shrink-0 mt-0.5" />
            <div>
              <strong>システム優先度:</strong><br />
              ここで設定されたAPIキーは、環境変数 (Environment Variables) よりも<strong>優先的に使用されます</strong>。
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
