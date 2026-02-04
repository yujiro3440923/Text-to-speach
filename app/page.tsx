'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Upload, FileText, Clock, ArrowRight, ArrowLeft, Wand2, Check, History, Settings, FileUp, X, Download, Volume2, LogOut, User, Gauge, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
  const CHARS_PER_SEC = 5.5; // 標準的なアナウンサーの速度
  const currentText = selectedTextSource === 'ai' ? aiRevisedText : inputText;
  const currentCharCount = currentText.length;
  const idealCharCount = Math.floor(seconds * CHARS_PER_SEC);
  const diffCount = idealCharCount - currentCharCount; // プラスなら足りない、マイナスなら多い

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
    setStep(2);
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setSaveStatus('idle');
    setSelectedTextSource('original'); 
    runAiSimulation();
  };

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
        toast.success('AI構成案作成完了');
      } else {
        setAiRevisedText('AIチェックエラー');
      }
    } catch {
      toast.error('通信エラーが発生しました');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 自動速度計算＆音声生成 ---
  const handlePreviewAudio = async () => {
    const textToRead = selectedTextSource === 'ai' ? aiRevisedText : inputText;
    
    if (!textToRead) return toast.warning('テキストがありません');
    if (selectedTextSource === 'ai' && isAiLoading) return toast.warning('AI処理中です');
    
    setIsGeneratingAudio(true);
    setAudioPreviewUrl(null);
    setAudioBlob(null);

    // ★ 自動速度計算ロジック
    // 標準的な所要時間(秒) = 文字数 / 5.5
    const estimatedDuration = textToRead.length / CHARS_PER_SEC;
    // 必要な倍率 = 標準所要時間 / 目標秒数
    // 例: 20秒かかる文章を10秒で読むなら 2.0倍速が必要
    let rate = estimatedDuration / seconds;
    
    // Google APIの制限 (0.25 ~ 4.0) に収める
    if (rate < 0.25) rate = 0.25;
    if (rate > 4.0) rate = 4.0;
    
    setCalculatedRate(rate); // 画面表示用

    try {
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: textToRead, 
          voiceName: selectedVoice,
          speakingRate: rate // 自動計算した速度を送信
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
        original_text: (selectedTextSource === 'ai' ? aiRevisedText : inputText).substring(0, 100),
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
          
          {/* STEP 1: 入力 */}
          {step === 1 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex gap-4">
                <button onClick={() => setActiveTab('text')} className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${activeTab === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}><FileText className="inline mr-2 w-4 h-4" /> テキスト入力</button>
                <button onClick={() => setActiveTab('file')} className={`text-sm font-medium px-4 py-2 rounded-full transition-all ${activeTab === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}><Upload className="inline mr-2 w-4 h-4" /> ファイル読込</button>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {activeTab === 'text' && (
                  <div className="relative">
                    <textarea rows={8} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="原稿を入力..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
                    {inputText && <button onClick={() => setInputText('')} className="absolute top-4 right-4 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                  </div>
                )}
                {activeTab === 'file' && (
                  <div className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isFileReading ? 'border-indigo-400 bg-indigo-50' : 'hover:bg-gray-50'} relative cursor-pointer`}>
                    {isFileReading ? <p className="text-indigo-600">解析中...</p> : <><FileUp size={28} className="mx-auto mb-4 text-gray-400" /><p>ファイルを選択</p><input type="file" accept=".txt,.csv,.docx,.xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /></>}
                  </div>
                )}

                <div className="pt-6 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock size={16} className="text-indigo-500" /> 目標秒数</label>
                    <span className="text-2xl font-black text-indigo-600">{seconds}<span className="text-sm font-normal text-gray-500 ml-1">秒</span></span>
                  </div>
                  <input type="range" min="5" max="120" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg cursor-pointer accent-indigo-600" />
                  <p className="text-xs text-gray-400 mt-2 text-right">目標文字数目安: 約{Math.floor(seconds * CHARS_PER_SEC)}文字</p>
                </div>

                <button onClick={handleGoToPreview} className="w-full py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold flex justify-center items-center gap-2">
                  次へ進む（チェック） <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 選択・調整・生成 */}
          {step === 2 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in-up">
              <div className="p-6 sm:p-8 space-y-8">
                
                {/* 文字数ステータスバー */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg text-indigo-600 shadow-sm">
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
                  <div className={`px-4 py-2 rounded-lg font-bold text-sm ${diffCount < 0 ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                    {diffCount === 0 ? 'ピッタリです！' : diffCount > 0 
                      ? `あと ${diffCount} 文字足りません` 
                      : `${Math.abs(diffCount)} 文字多いです (速度で調整します)`
                    }
                  </div>
                </div>

                {/* テキスト選択エリア */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 元の原稿 */}
                  <div 
                    onClick={() => setSelectedTextSource('original')}
                    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedTextSource === 'original' ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-gray-500 uppercase">ORIGINAL</span>
                      {selectedTextSource === 'original' && <Check size={18} className="text-indigo-600" />}
                    </div>
                    <div className="text-sm text-gray-700 h-40 overflow-y-auto whitespace-pre-wrap">{inputText}</div>
                  </div>

                  {/* AI修正案 */}
                  <div 
                    onClick={() => !isAiLoading && setSelectedTextSource('ai')}
                    className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedTextSource === 'ai' ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-100' : 'border-gray-200 hover:border-purple-300'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-purple-600 uppercase">AI SUGGESTION</span>
                      {selectedTextSource === 'ai' && <Check size={18} className="text-purple-600" />}
                    </div>
                    <div className="text-sm text-gray-800 h-40 overflow-y-auto whitespace-pre-wrap">
                      {isAiLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-purple-400 text-xs">
                          <div className="animate-spin w-5 h-5 border-2 border-purple-200 border-t-purple-500 rounded-full mb-2"></div>
                          構成案を作成中...
                        </div>
                      ) : aiRevisedText}
                    </div>
                  </div>
                </div>
                
                {/* 音声生成設定 & 自動速度表示 */}
                <div className="pt-8 border-t border-gray-100 bg-gray-50 rounded-xl p-6">
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
                        className="w-full px-8 py-3 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 font-bold text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingAudio ? <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div> : <Volume2 size={18} />}
                        {isGeneratingAudio ? '生成中...' : '自動速度調整して試聴'}
                      </button>
                    </div>
                  </div>

                  {/* 自動調整の結果表示 */}
                  {audioPreviewUrl && (
                    <div className="mt-6 animate-fade-in bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                        <Zap size={16} className="text-yellow-500" />
                        <span>調整結果: <span className="text-indigo-600">x{calculatedRate.toFixed(2)}倍速</span> で生成しました</span>
                      </div>
                      <audio controls src={audioPreviewUrl} className="w-full" />
                      <p className="text-center text-xs text-gray-400 mt-2">※ 内容が良ければ下のボタンで保存してください</p>
                    </div>
                  )}
                </div>

                {/* フッターボタン */}
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setStep(1)} className="flex-1 py-4 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-bold flex justify-center items-center gap-2">
                    <ArrowLeft size={18} /> 入力に戻る
                  </button>
                  <button
                    onClick={handleDownloadAndSave}
                    disabled={!audioBlob || saveStatus !== 'idle'}
                    className={`flex-1 py-4 rounded-xl font-bold text-white shadow-md flex justify-center items-center gap-2 ${
                      !audioBlob ? 'bg-gray-300 cursor-not-allowed' : 
                      saveStatus === 'saved' ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
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