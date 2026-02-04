'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Save, Lock, Key, Building2, Eye, EyeOff, Unlock } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // --- 状態管理 ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(true); // 初期状態はロック
  const [inputPassword, setInputPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 編集用データ
  const [companyName, setCompanyName] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [googleKey, setGoogleKey] = useState('');
  const [newPassword, setNewPassword] = useState(''); // 変更する場合のみ入力

  // DB上の正解パスワード（本来はサーバーサイドで検証すべきですが、簡易版としてフロントで照合）
  const [correctPassword, setCorrectPassword] = useState('');

  const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

  // 1. データ読み込み
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', DEMO_ORG_ID)
        .single();

      if (data) {
        setCompanyName(data.name || '');
        setOpenaiKey(data.openai_api_key || '');
        setGoogleKey(data.google_api_key || '');
        setCorrectPassword(data.password || '1234');
      }
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  // 2. ロック解除処理
  const handleUnlock = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputPassword === correctPassword) {
      setIsLocked(false);
    } else {
      alert('パスワードが違います');
    }
  };

  // 3. 保存処理
  const handleSave = async () => {
    setSaving(true);

    const updates: any = {
      openai_api_key: openaiKey,
      google_api_key: googleKey,
    };

    // パスワードが入力されていれば更新
    if (newPassword) {
      updates.password = newPassword;
    }

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', DEMO_ORG_ID);

    if (error) {
      alert('保存に失敗しました: ' + error.message);
    } else {
      alert('設定を保存しました！' + (newPassword ? '\nパスワードも変更されました。' : ''));
      if (newPassword) setCorrectPassword(newPassword);
      setNewPassword(''); // 入力欄クリア
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center">読み込み中...</div>;

  // --- ロック画面 ---
  if (isLocked) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col justify-center items-center px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 border border-gray-200 text-center">
          <div className="mx-auto bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
            <Lock className="text-indigo-600" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">管理者認証</h2>
          <p className="text-gray-500 mb-6 text-sm">
            設定を変更するにはパスワードを入力してください。<br/>(初期設定: 1234)
          </p>
          
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              placeholder="パスワードを入力"
              className="w-full px-4 py-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <Link href="/" className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium">
                キャンセル
              </Link>
              <button
                type="submit"
                className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm flex items-center justify-center gap-2"
              >
                <Unlock size={16} /> 解除する
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  // --- 設定画面 (ロック解除後) ---
  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <Building2 className="text-gray-700" /> 設定画面
          </h1>
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white py-2 px-4 rounded-md border border-gray-300 shadow-sm transition-colors">
            <ArrowLeft size={16} /> ホームに戻る
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-6 space-y-8">
            
            {/* 会社名 */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2">基本情報</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700">会社名</label>
                <input type="text" disabled value={companyName} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md text-gray-500 sm:text-sm" />
              </div>
            </div>

            {/* APIキー */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
                <Key size={20} /> APIキー設定
              </h2>
              <div className="grid gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">OpenAI API Key</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 pl-3 pr-10 border"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Google Cloud API Key</label>
                  <input
                    type="password"
                    value={googleKey}
                    onChange={(e) => setGoogleKey(e.target.value)}
                    className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border"
                  />
                </div>
              </div>
            </div>

            {/* パスワード変更 */}
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
                <Lock size={20} /> セキュリティ設定
              </h2>
              <div className="p-4 bg-yellow-50 rounded-md border border-yellow-200">
                <label className="block text-sm font-medium text-yellow-800 mb-1">新しいパスワードに変更する</label>
                <input
                  type="password"
                  placeholder="変更しない場合は空欄のまま"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full sm:text-sm border-gray-300 rounded-md py-2 px-3 border focus:ring-yellow-500 focus:border-yellow-500"
                />
                <p className="mt-2 text-xs text-yellow-700">
                  ※次回からこの設定画面を開くために必要になります。忘れないようにご注意ください。
                </p>
              </div>
            </div>

          </div>
          
          <div className="px-6 py-4 bg-gray-50 text-right border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex justify-center items-center gap-2 py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}