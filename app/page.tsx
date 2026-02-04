'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Upload, FileText, Clock, ArrowRight, ArrowLeft, Wand2, PlayCircle, Check, History, Settings, FileUp, X, Download, Volume2, LogOut, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner'; // 通知用
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export default function Home() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // --- 状態管理 ---
  const [userEmail, setUserEmail] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [inputText, setInputText] = useState('');
  const [seconds, setSeconds] = useState(20);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  
  // AIチェック & 音声
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRevisedText, setAiRevisedText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('ja-JP-Neural2-B');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isFileReading, setIsFileReading] = useState(false);

  // ログインチェック
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      } else {
        setUserEmail(session.user.email || '');
      }
    };
    checkUser();
  }, [router, supabase]);

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.info('ログアウトしました');
    router.replace('/login');
  };

  // --- ファイル読み込み ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsFileReading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let extractedText = '';

      if (file.name.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer });
        extractedText = result.value;
      } else if (file.name.match(/\.(xlsx|xlsm|csv)$/)) {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        extractedText = jsonData.map((row: any) => row.join(' ')).join('\n');
      } else {
        extractedText = await file.text();
      }

      setInputText(prev => prev + (prev ? '\n\n' : '') + extractedText);
      setActiveTab('text');
      toast.success(`${file.name} を読み込みました`);
    } catch (error) {
      toast.error('ファイルの読み込みに失敗しました');
    } finally {
      setIsFileReading(false);
      e.target.value = ''; 
    }
  };

  // --- 画面遷移 ---
  const handleGoToPreview = () => {
    if (!inputText) return toast.warning('テキストを入力してください');
    setStep(2);
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setSaveStatus('idle');
    runAiSimulation();
  };

  // --- AIチェック ---
  const runAiSimulation = async () => {
    setIsAiLoading(true);
    setAiRevisedText('');
    try {
      const response = await fetch('/api/check-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, seconds: seconds }),
      });
      const data = await response.json();
      if (response.ok && data.result) {
        setAiRevisedText(data.result);
        toast.success('AIチェック完了');
      } else {
        setAiRevisedText(data.error || 'エラー発生');
        toast.error('AIチェックに失敗しました');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 音声生成 (試聴) ---
  const handlePreviewAudio = async () => {
    const textToRead = aiRevisedText || inputText;
    if (!textToRead) return;
    
    setIsGeneratingAudio(true);
    setAudioPreviewUrl(null);
    setAudioBlob(null);

    try {
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead, voiceName: selectedVoice }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = window.URL.createObjectURL(blob);

      setAudioBlob(blob);
      setAudioPreviewUrl(url);
      toast.success('音声生成完了！再生して確認してください');

    } catch (error: any) {
      toast.error('音声生成エラー: ' + error.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // --- 保存 ---
  const handleDownloadAndSave = async () => {
    if (!audioBlob) return;
    setSaveStatus('saving');

    try {
      const timeStamp = new Date().getTime();
      const dlFileName = `radio_${timeStamp}.mp3`;
      
      // DL
      const url = window.URL.createObjectURL(audioBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = dlFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Supabase Save
      const { error: uploadError } = await supabase.storage.from('audio-files').upload(`public/${dlFileName}`, audioBlob);
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage.from('audio-files').getPublicUrl(`public/${dlFileName}`);
      const { error: dbError } = await supabase.from('histories').insert({
        original_text: (aiRevisedText || inputText).substring(0, 100),
        target_seconds: seconds,
        file_url: publicUrlData.publicUrl,
        status: 'completed'
      });
      if (dbError) throw dbError;

      setSaveStatus('saved');
      toast.success('ダウンロードと履歴への保存が完了しました');

    } catch (error: any) {
      toast.error('保存エラー: ' + error.message);
      setSaveStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* --- ヘッダー --- */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Wand2 size={20} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight hidden sm:block">
              Radio Audio Gen
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/history" className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="履歴">
              <History size={20} />
            </Link>
            <Link href="/settings" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors" title="設定">
              <Settings size={20} />
            </Link>
            <div className="h-6 w-px bg-gray-200 mx-1"></div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 hidden md:block truncate max-w-[150px]">{userEmail}</span>
              <button onClick={handleLogout} className="text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 py-2 px-3 rounded-md transition-colors flex items-center gap-1">
                <LogOut size={14} /> ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* --- ステップバー (Visual) --- */}
          <div className="relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
            <div className="flex justify-between w-2/3 mx-auto">
              <div className={`flex flex-col items-center gap-2 bg-gray-50 px-2 ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-all ${step >= 1 ? 'bg-indigo-600 text-white border-indigo-100' : 'bg-gray-200 border-gray-100 text-gray-500'}`}>
                  1
                </div>
                <span className="text-xs font-bold">原稿作成</span>
              </div>
              <div className={`flex flex-col items-center gap-2 bg-gray-50 px-2 ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-all ${step >= 2 ? 'bg-indigo-600 text-white border-indigo-100' : 'bg-gray-200 border-gray-100 text-gray-500'}`}>
                  2
                </div>
                <span className="text-xs font-bold">AI構成・生成</span>
              </div>
            </div>
          </div>

          {/* --- STEP 1: 入力 --- */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex gap-4">
                <button 
                  onClick={() => setActiveTab('text')} 
                  className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${activeTab === 'text' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <FileText className="inline mr-2 w-4 h-4" /> テキスト入力
                </button>
                <button 
                  onClick={() => setActiveTab('file')} 
                  className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${activeTab === 'file' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Upload className="inline mr-2 w-4 h-4" /> ファイル読込
                </button>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {activeTab === 'text' && (
                  <div className="relative group">
                    <textarea
                      rows={8}
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-y text-gray-800 text-sm leading-relaxed"
                      placeholder="ここに原稿を入力するか、ファイル読込タブからファイルをアップロードしてください..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    {inputText && (
                      <button onClick={() => setInputText('')} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="クリア">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}
                
                {activeTab === 'file' && (
                  <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isFileReading ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'} relative cursor-pointer group`}>
                    {isFileReading ? (
                      <div className="space-y-3">
                        <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto"></div>
                        <p className="text-sm text-indigo-600 font-medium">ファイルを解析中...</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <FileUp size={28} />
                        </div>
                        <p className="text-gray-900 font-medium mb-1">ファイルを選択またはドラッグ</p>
                        <p className="text-xs text-gray-500 mb-4">対応形式: .docx, .xlsx, .csv, .txt</p>
                        <input type="file" accept=".txt,.csv,.docx,.xlsx,.xlsm" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </>
                    )}
                  </div>
                )}

                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Clock size={16} className="text-indigo-500" /> 目標秒数
                    </label>
                    <span className="text-2xl font-black text-indigo-600">{seconds}<span className="text-sm font-normal text-gray-500 ml-1">秒</span></span>
                  </div>
                  <input type="range" min="5" max="120" step="1" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  <div className="flex justify-between text-xs text-gray-400 mt-2 font-mono">
                    <span>5s</span>
                    <span>120s</span>
                  </div>
                </div>

                <button onClick={handleGoToPreview} className="w-full py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 hover:shadow-lg transition-all font-bold text-base flex justify-center items-center gap-2 group">
                  次へ進む <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )}

          {/* --- STEP 2: プレビュー --- */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
              <div className="p-6 sm:p-8 space-y-8">
                <div className="flex items-center gap-2 mb-4">
                  <Wand2 className="text-purple-500" />
                  <h2 className="text-lg font-bold text-gray-900">AIによる構成チェック</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-gray-400 tracking-wider">ORIGINAL</span>
                    <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 h-48 overflow-y-auto border border-gray-100">{inputText}</div>
                  </div>
                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-purple-600 tracking-wider">AI SUGGESTION</span>
                      {isAiLoading && <span className="text-xs text-purple-400 animate-pulse">Thinking...</span>}
                    </div>
                    <div className={`p-4 rounded-xl text-sm h-48 overflow-y-auto border transition-all ${isAiLoading ? 'bg-purple-50 border-purple-100 text-purple-300' : 'bg-white border-purple-200 ring-4 ring-purple-50/50 text-gray-800 shadow-sm'}`}>
                      {isAiLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3">
                          <div className="animate-spin w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full"></div>
                        </div>
                      ) : aiRevisedText}
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-100">
                  <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                      <div className="w-full md:flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Voice Actor</label>
                        <div className="relative">
                          <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="block w-full py-3 px-4 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm appearance-none text-sm font-medium">
                            <option value="ja-JP-Neural2-B">女性アナウンサー (Neural2-B)</option>
                            <option value="ja-JP-Neural2-C">男性アナウンサー (Neural2-C)</option>
                            <option value="ja-JP-Neural2-D">男性ナレーター (Neural2-D)</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                            <User size={16} />
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={handlePreviewAudio}
                        disabled={isGeneratingAudio || isAiLoading}
                        className="w-full md:w-auto px-8 py-3 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isGeneratingAudio ? <Loader2 className="animate-spin" size={18} /> : <Volume2 size={18} />}
                        {isGeneratingAudio ? '生成中...' : '音声を試聴する'}
                      </button>
                    </div>

                    {audioPreviewUrl && (
                      <div className="mt-6 animate-fade-in bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                        <audio controls src={audioPreviewUrl} className="w-full" />
                        <p className="text-center text-xs text-gray-400 mt-2">※ 内容が良ければ「ダウンロードして保存」を押してください</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setStep(1)} className="flex-1 py-4 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold transition-all flex justify-center items-center gap-2">
                    <ArrowLeft size={18} /> 修正する
                  </button>
                  <button
                    onClick={handleDownloadAndSave}
                    disabled={!audioBlob || saveStatus === 'saved' || saveStatus === 'saving'}
                    className={`flex-1 py-4 rounded-xl font-bold text-white shadow-md transition-all flex justify-center items-center gap-2 ${
                      !audioBlob ? 'bg-gray-300 cursor-not-allowed' : 
                      saveStatus === 'saved' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                  >
                    {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? <><Check size={20} /> 保存完了</> : <><Download size={20} /> ダウンロードして保存</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// 読み込み中用のアイコンコンポーネント
function Loader2({ className, size }: { className?: string, size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;
}