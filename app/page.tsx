'use client';

import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
// ↓ ここに 'Clock' を追加しました
import { Upload, FileText, ArrowRight, ArrowLeft, Wand2, Check, History, Settings, FileUp, X, Download, Volume2, LogOut, User, Gauge, Zap, Play, Clock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// --- iOS風タイムピッカーコンポーネント ---
const TimePicker = ({ seconds, onChange }: { seconds: number, onChange: (val: number) => void }) => {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  
  // 選択肢 (分: 0~20分, 秒: 0~59秒)
  const minutesRange = Array.from({ length: 21 }, (_, i) => i);
  const secondsRange = Array.from({ length: 60 }, (_, i) => i);

  // スクロール処理用のRef
  const minRef = useRef<HTMLDivElement>(null);
  const secRef = useRef<HTMLDivElement>(null);

  // 初期位置合わせ
  useEffect(() => {
    if (minRef.current) minRef.current.scrollTop = min * 40;
    if (secRef.current) secRef.current.scrollTop = sec * 40;
  }, []); // 初回のみ

  const handleScroll = (type: 'min' | 'sec', e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const itemHeight = 40; // css class h-10 = 40px
    const index = Math.round(target.scrollTop / itemHeight);
    
    if (type === 'min') {
      const newMin = minutesRange[index] || 0;
      onChange(newMin * 60 + sec);
    } else {
      const newSec = secondsRange[index] || 0;
      onChange(min * 60 + newSec);
    }
  };

  return (
    <div className="flex justify-center items-center bg-gray-900 text-white rounded-xl p-6 shadow-inner w-full max-w-sm mx-auto select-none relative overflow-hidden">
      {/* 選択ハイライトバー (中央) */}
      <div className="absolute top-1/2 left-4 right-4 h-10 bg-white/10 rounded-lg -translate-y-1/2 pointer-events-none z-0 border border-white/20"></div>

      {/* ラベル */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-bold text-xl z-10 pb-1">:</div>
      <div className="absolute top-4 left-0 w-full text-center text-xs text-gray-400 font-bold uppercase tracking-widest pointer-events-none">
        <span className="mr-16">Min</span> <span className="ml-16">Sec</span>
      </div>

      <div className="flex gap-8 z-10 h-40 items-center">
        {/* 分のカラム */}
        <div 
          ref={minRef}
          onScroll={(e) => handleScroll('min', e)}
          className="h-40 w-20 overflow-y-scroll snap-y snap-mandatory scrollbar-hide text-center"
        >
          <div className="h-16"></div> {/* パディング上 */}
          {minutesRange.map((m) => (
            <div key={m} className={`h-10 flex items-center justify-center snap-center transition-all ${m === min ? 'text-2xl font-bold text-white' : 'text-lg text-gray-500 scale-90'}`}>
              {m.toString().padStart(2, '0')}
            </div>
          ))}
          <div className="h-16"></div> {/* パディング下 */}
        </div>

        {/* 秒のカラム */}
        <div 
          ref={secRef}
          onScroll={(e) => handleScroll('sec', e)}
          className="h-40 w-20 overflow-y-scroll snap-y snap-mandatory scrollbar-hide text-center"
        >
          <div className="h-16"></div>
          {secondsRange.map((s) => (
            <div key={s} className={`h-10 flex items-center justify-center snap-center transition-all ${s === sec ? 'text-2xl font-bold text-white' : 'text-lg text-gray-500 scale-90'}`}>
              {s.toString().padStart(2, '0')}
            </div>
          ))}
          <div className="h-16"></div>
        </div>
      </div>
      
      {/* グラデーションオーバーレイ (上下のフェード) */}
      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-gray-900 to-transparent pointer-events-none z-20"></div>
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none z-20"></div>
    </div>
  );
};


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
  // 初期値 60秒
  const [seconds, setSeconds] = useState(60); 
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  
  // AIチェック & 選択
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRevisedText, setAiRevisedText] = useState('');
  const [selectedTextSource, setSelectedTextSource] = useState<'original' | 'ai'>('original');

  // 音声生成設定
  const [selectedVoice, setSelectedVoice] = useState('ja-JP-Neural2-B');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isFileReading, setIsFileReading] = useState(false);
  
  // 計算された再生速度 (表示用)
  const [calculatedRate, setCalculatedRate] = useState(1.0);

  // --- 文字数計算ロジック ---
  const CHARS_PER_SEC = 5.5; 
  // 選択中のテキストの内容
  const currentText = selectedTextSource === 'ai' ? aiRevisedText : inputText;
  const currentCharCount = currentText.length;
  const idealCharCount = Math.floor(seconds * CHARS_PER_SEC);
  const diffCount = idealCharCount - currentCharCount;

  // ログインチェック
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.replace('/login');
      else setUserEmail(session.user.email || '');
    };
    checkUser();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.info('ログアウトしました');
    router.replace('/login');
  };

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
    } catch {
      toast.error('ファイルの読み込みに失敗しました');
    } finally {
      setIsFileReading(false);
      e.target.value = ''; 
    }
  };

  const handleGoToPreview = () => {
    if (!inputText) return toast.warning('テキストを入力してください');
    if (seconds < 5) return toast.warning('秒数は5秒以上に設定してください');
    
    setStep(2);
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setSaveStatus('idle');
    setSelectedTextSource('original'); 
    
    // 画面遷移時にAIチェックを走らせる
    runAiSimulation();
  };

  const runAiSimulation = async () => {
    setIsAiLoading(true);
    setAiRevisedText(''); // クリア
    try {
      const response = await fetch('/api/check-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, seconds: seconds }),
      });
      const data = await response.json();
      if (response.ok && data.result) {
        setAiRevisedText(data.result);
        toast.success('AI構成案作成完了');
      } else {
        setAiRevisedText('AIチェックエラー: 生成できませんでした');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePreviewAudio = async () => {
    const textToRead = selectedTextSource === 'ai' ? aiRevisedText : inputText;
    
    if (!textToRead) return toast.warning('テキストがありません');
    if (selectedTextSource === 'ai' && isAiLoading) return toast.warning('AI処理中です');
    
    setIsGeneratingAudio(true);
    setAudioPreviewUrl(null);
    setAudioBlob(null);

    // 自動速度計算
    const estimatedDuration = textToRead.length / CHARS_PER_SEC;
    let rate = estimatedDuration / seconds;
    
    if (rate < 0.25) rate = 0.25;
    if (rate > 4.0) rate = 4.0;
    
    setCalculatedRate(rate);

    try {
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: textToRead, 
          voiceName: selectedVoice,
          speakingRate: rate
        }),
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
      toast.success(`目標${seconds}秒に合わせて x${rate.toFixed(2)}倍速で生成しました`);

    } catch (error: any) {
      toast.error('生成エラー: ' + error.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleDownloadAndSave = async () => {
    if (!audioBlob) return;
    setSaveStatus('saving');
    try {
      const timeStamp = new Date().getTime();
      const dlFileName = `radio_${timeStamp}.mp3`;
      const url = window.URL.createObjectURL(audioBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = dlFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const { error: uploadError } = await supabase.storage.from('audio-files').upload(`public/${dlFileName}`, audioBlob);
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage.from('audio-files').getPublicUrl(`public/${dlFileName}`);
      const { error: dbError } = await supabase.from('histories').insert({
        original_text: currentText.substring(0, 100),
        target_seconds: seconds,
        file_url: publicUrlData.publicUrl,
        status: 'completed'
      });
      if (dbError) throw dbError;

      setSaveStatus('saved');
      toast.success('保存完了');
    } catch (error: any) {
      toast.error('保存エラー: ' + error.message);
      setSaveStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style jsx global>{`
        /* スクロールバーを隠すためのユーティリティ */
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white"><Wand2 size={20} /></div>
            <h1 className="text-xl font-bold text-gray-900 hidden sm:block">Radio Audio Gen</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/history" className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"><History size={20} /></Link>
            <Link href="/settings" className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full"><Settings size={20} /></Link>
            <button onClick={handleLogout} className="text-xs font-medium text-red-600 hover:bg-red-50 py-2 px-3 rounded-md flex items-center gap-1"><LogOut size={14} /> ログアウト</button>
          </div>
        </div>
      </header>

      <main className="py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* STEP 1: 入力画面 */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex gap-4">
                <button onClick={() => setActiveTab('text')} className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${activeTab === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}><FileText className="inline mr-2 w-4 h-4" /> テキスト入力</button>
                <button onClick={() => setActiveTab('file')} className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${activeTab === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}><Upload className="inline mr-2 w-4 h-4" /> ファイルアップロード</button>
              </div>

              <div className="p-6 sm:p-8 space-y-8">
                {/* テキスト入力エリア */}
                {activeTab === 'text' && (
                  <div className="relative">
                    <textarea 
                      rows={8} 
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm placeholder-gray-400" 
                      placeholder="ここに原稿を入力してください..." 
                      value={inputText} 
                      onChange={(e) => setInputText(e.target.value)} 
                    />
                    {inputText && <button onClick={() => setInputText('')} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 p-1 bg-white rounded-full shadow-sm"><X size={16} /></button>}
                  </div>
                )}
                
                {/* ファイルアップロードエリア */}
                {activeTab === 'file' && (
                  <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isFileReading ? 'border-indigo-400 bg-indigo-50' : 'hover:bg-gray-50 border-gray-300'} relative cursor-pointer group`}>
                    {isFileReading ? (
                      <p className="text-indigo-600 animate-pulse font-medium">ファイルを解析中...</p>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                          <FileUp size={32} />
                        </div>
                        <p className="font-bold text-gray-700">クリックしてファイルを選択</p>
                        <p className="text-sm text-gray-500 mt-1">またはドラッグ＆ドロップ</p>
                        <p className="text-xs text-gray-400 mt-2">対応形式: .txt, .docx, .xlsx, .csv</p>
                        <input type="file" accept=".txt,.csv,.docx,.xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      </>
                    )}
                  </div>
                )}

                {/* iOS風 タイムピッカー */}
                <div className="pt-6 border-t border-gray-100">
                  <div className="text-center mb-6">
                    <label className="text-sm font-bold text-gray-700 flex items-center justify-center gap-2 mb-1">
                      <Clock size={16} className="text-indigo-500" /> 完成音声の長さ (最大20分)
                    </label>
                    <p className="text-xs text-gray-500">ドラムを回して時間を設定してください</p>
                  </div>
                  
                  <TimePicker 
                    seconds={seconds} 
                    onChange={setSeconds} 
                  />

                  <div className="text-center mt-4 text-indigo-600 font-bold text-lg">
                    設定: {Math.floor(seconds / 60)}分 {seconds % 60}秒
                  </div>
                </div>

                <button onClick={handleGoToPreview} className="w-full py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold flex justify-center items-center gap-2 shadow-lg hover:shadow-xl transition-all">
                  処理を開始する <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 確認・編集・生成画面 */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
              <div className="p-6 sm:p-8 space-y-8">
                
                {/* 文字数ステータスバー */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
                      <Gauge size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase">文字数ステータス</p>
                      <p className="text-sm font-bold text-gray-900">
                        現在: <span className="text-indigo-600 text-lg">{currentCharCount}</span> 文字 
                        <span className="mx-2 text-gray-300">|</span> 
                        目標目安: {idealCharCount} 文字
                      </p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-lg font-bold text-xs md:text-sm flex items-center gap-2 ${diffCount < 0 ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-blue-50 text-blue-700 border border-blue-100'}`}>
                     {diffCount === 0 ? <Check size={16} /> : <Zap size={16} />}
                     {diffCount === 0 ? 'ピッタリです！' : diffCount > 0 
                      ? `あと ${diffCount} 文字足りません` 
                      : `${Math.abs(diffCount)} 文字多いです (自動で速度調整します)`
                    }
                  </div>
                </div>

                {/* 編集可能なテキストエリア (2カラム) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 左: オリジナル (編集可能) */}
                  <div 
                    onClick={() => setSelectedTextSource('original')}
                    className={`relative border-2 rounded-xl p-1 transition-all flex flex-col h-full ${selectedTextSource === 'original' ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}
                  >
                    <div className={`px-4 py-3 border-b flex justify-between items-center ${selectedTextSource === 'original' ? 'bg-indigo-50/50' : 'bg-gray-50'}`}>
                      <span className="text-xs font-bold text-gray-500 uppercase">ORIGINAL (編集可)</span>
                      {selectedTextSource === 'original' && <div className="bg-indigo-600 text-white rounded-full p-1"><Check size={12} /></div>}
                    </div>
                    <textarea 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 w-full p-4 resize-none focus:outline-none text-sm text-gray-700 min-h-[200px] rounded-b-lg"
                      placeholder="ここに原稿が表示されます"
                    />
                  </div>

                  {/* 右: AI提案 (編集可能) */}
                  <div 
                    onClick={() => !isAiLoading && setSelectedTextSource('ai')}
                    className={`relative border-2 rounded-xl p-1 transition-all flex flex-col h-full ${selectedTextSource === 'ai' ? 'border-purple-600 ring-4 ring-purple-50' : 'border-gray-200 hover:border-purple-300'}`}
                  >
                    <div className={`px-4 py-3 border-b flex justify-between items-center ${selectedTextSource === 'ai' ? 'bg-purple-50/50' : 'bg-gray-50'}`}>
                      <span className="text-xs font-bold text-purple-600 uppercase">AI SUGGESTION ({seconds}秒 調整版)</span>
                      {selectedTextSource === 'ai' && <div className="bg-purple-600 text-white rounded-full p-1"><Check size={12} /></div>}
                    </div>
                    
                    {isAiLoading ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-purple-400 text-xs min-h-[200px]">
                        <div className="animate-spin w-8 h-8 border-4 border-purple-100 border-t-purple-500 rounded-full mb-3"></div>
                        AIが最適な長さに調整中...
                      </div>
                    ) : (
                      <textarea 
                        value={aiRevisedText}
                        onChange={(e) => setAiRevisedText(e.target.value)}
                        className="flex-1 w-full p-4 resize-none focus:outline-none text-sm text-gray-800 min-h-[200px] rounded-b-lg"
                        placeholder="AIによる修正案がここに表示されます"
                      />
                    )}
                  </div>
                </div>
                
                {/* フッター操作エリア */}
                <div className="pt-8 border-t border-gray-100 bg-gray-50 -mx-6 -mb-6 px-6 py-6 md:px-8 md:py-8 mt-4">
                  <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="w-full md:flex-1">
                      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Voice Actor</label>
                      <div className="relative">
                        <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="block w-full py-3 px-4 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm text-sm">
                          <option value="ja-JP-Neural2-B">女性アナウンサー (Neural2-B)</option>
                          <option value="ja-JP-Neural2-C">男性アナウンサー (Neural2-C)</option>
                          <option value="ja-JP-Neural2-D">男性ナレーター (Neural2-D)</option>
                        </select>
                        <User size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="w-full md:w-auto">
                      <button
                        onClick={handlePreviewAudio}
                        disabled={isGeneratingAudio || (selectedTextSource === 'ai' && isAiLoading)}
                        className="w-full px-8 py-3 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 font-bold text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                      >
                        {isGeneratingAudio ? <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div> : <Volume2 size={18} />}
                        {isGeneratingAudio ? '生成中...' : '自動速度調整して試聴'}
                      </button>
                    </div>
                  </div>

                  {/* 試聴プレイヤー & 保存ボタン */}
                  {audioPreviewUrl && (
                    <div className="mt-6 animate-fade-in bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                           <Play size={16} className="text-green-500" /> プレビュー再生
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">x{calculatedRate.toFixed(2)}倍速で生成</span>
                      </div>
                      
                      <audio controls src={audioPreviewUrl} className="w-full" />
                      
                      <div className="pt-4 border-t border-gray-100 flex justify-end">
                         <button
                          onClick={handleDownloadAndSave}
                          disabled={saveStatus !== 'idle'}
                          className={`w-full md:w-auto px-8 py-3 rounded-xl font-bold text-white shadow-md flex justify-center items-center gap-2 transition-all ${
                            saveStatus === 'saved' ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg'
                          }`}
                        >
                          {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? <><Check size={20} /> 保存完了</> : <><Download size={20} /> ダウンロードして保存</>}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* 戻るボタン */}
                  {!audioPreviewUrl && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <button onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-800 text-sm font-bold flex items-center gap-2">
                        <ArrowLeft size={16} /> 入力画面に戻る
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}