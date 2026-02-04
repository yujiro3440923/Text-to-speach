'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Upload, FileText, Clock, ArrowRight, ArrowLeft, Wand2, PlayCircle, Check, History, Settings, FileUp, X, Download, Volume2 } from 'lucide-react';
import Link from 'next/link';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export default function Home() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // --- 状態管理 ---
  const [step, setStep] = useState<1 | 2>(1);
  const [inputText, setInputText] = useState('');
  const [seconds, setSeconds] = useState(20);
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  
  // AIチェック用
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiRevisedText, setAiRevisedText] = useState('');
  
  // 音声生成・試聴用
  const [selectedVoice, setSelectedVoice] = useState('ja-JP-Neural2-B');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null); // 試聴用URL
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null); // 保存用データ

  // 保存状態
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // ファイル読み込み
  const [isFileReading, setIsFileReading] = useState(false);

  // --- 関数: ファイル読み込み ---
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
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm') || file.name.endsWith('.csv')) {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        extractedText = jsonData.map((row: any) => row.join(' ')).join('\n');
      } else {
        extractedText = await file.text();
      }

      setInputText(prev => prev + (prev ? '\n\n' : '') + extractedText);
      setActiveTab('text');
      alert(`${file.name} を読み込みました！`);
    } catch (error) {
      console.error(error);
      alert('ファイルの読み込みに失敗しました。');
    } finally {
      setIsFileReading(false);
      e.target.value = ''; 
    }
  };

  // --- 関数: 次へ ---
  const handleGoToPreview = () => {
    if (!inputText) return alert('テキストを入力してください');
    setStep(2);
    // 画面遷移時はリセット
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setSaveStatus('idle');
    runAiSimulation();
  };

  // --- 関数: AIチェック ---
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
      } else {
        setAiRevisedText('AIチェックエラー: ' + (data.error || '不明なエラー'));
      }
    } catch (error) {
      setAiRevisedText('通信エラーが発生しました。');
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- 関数: 音声生成 (試聴用) ---
  const handlePreviewAudio = async () => {
    const textToRead = aiRevisedText || inputText;
    if (!textToRead) return alert('読み上げるテキストがありません');
    
    setIsGeneratingAudio(true);
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setSaveStatus('idle');

    try {
      const response = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead, voiceName: selectedVoice }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      // Base64 -> Blob -> URL
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = window.URL.createObjectURL(blob);

      setAudioBlob(blob); // 後で保存するために取っておく
      setAudioPreviewUrl(url); // プレイヤーにセット

    } catch (error: any) {
      console.error(error);
      alert('音声生成エラー: ' + error.message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // --- 関数: ダウンロード＆保存 ---
  const handleDownloadAndSave = async () => {
    if (!audioBlob) return alert('まずは音声を生成してください');
    
    setSaveStatus('saving');

    try {
      // 1. ダウンロード (ユーザーPCへ)
      const url = window.URL.createObjectURL(audioBlob);
      const link = document.createElement('a');
      const timeStamp = new Date().getTime();
      const dlFileName = `radio_${timeStamp}.mp3`;
      link.href = url;
      link.download = dlFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 2. Supabaseへアップロード
      const { error: uploadError } = await supabase.storage.from('audio-files').upload(`public/${dlFileName}`, audioBlob);
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage.from('audio-files').getPublicUrl(`public/${dlFileName}`);
      
      // 3. 履歴DBへ保存
      const { error: dbError } = await supabase.from('histories').insert({
        original_text: (aiRevisedText || inputText).substring(0, 100),
        target_seconds: seconds,
        file_url: publicUrlData.publicUrl,
        status: 'completed'
      });
      if (dbError) throw dbError;

      setSaveStatus('saved');

    } catch (error: any) {
      console.error(error);
      alert('保存エラー: ' + error.message);
      setSaveStatus('idle');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full space-y-8">
        
        {/* ヘッダー */}
        <div className="flex justify-between items-center px-4">
          <div className="text-left">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              Radio Audio Generator
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              ステップ {step} / 3
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/history" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors">
              <History size={20} />
              <span className="font-medium">履歴</span>
            </Link>
            <Link href="/settings" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
              <Settings size={20} />
              <span className="font-medium">設定</span>
            </Link>
          </div>
        </div>

        {/* --- STEP 1: 入力 --- */}
        {step === 1 && (
          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10 border border-gray-200">
             {/* タブ */}
             <div className="flex border-b border-gray-200 mb-6">
              <button onClick={() => setActiveTab('text')} className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm flex items-center justify-center gap-2 ${activeTab === 'text' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                <FileText size={18} /> テキスト入力
              </button>
              <button onClick={() => setActiveTab('file')} className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm flex items-center justify-center gap-2 ${activeTab === 'file' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500'}`}>
                <Upload size={18} /> ファイル読込
              </button>
            </div>

            <div className="space-y-6">
              {activeTab === 'text' && (
                <div className="relative">
                  <textarea
                    rows={8}
                    className="shadow-sm p-3 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border border-gray-300 rounded-md"
                    placeholder="原稿を入力..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                  />
                  {inputText && (
                    <button onClick={() => setInputText('')} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
              
              {activeTab === 'file' && (
                <div className="border-2 border-dashed border-gray-300 rounded-md p-10 text-center hover:bg-gray-50 transition-colors relative">
                  {isFileReading ? (
                    <div className="space-y-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="text-sm text-gray-500">解析中...</p>
                    </div>
                  ) : (
                    <>
                      <FileUp className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm text-gray-600 mb-1">ファイルを選択 (.docx, .xlsx, .txt)</p>
                      <input type="file" accept=".txt,.csv,.docx,.xlsx,.xlsm" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    </>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Clock size={16} /> 目標秒数: <span className="text-xl font-bold text-indigo-600">{seconds}秒</span>
                </label>
                <input type="range" min="5" max="120" step="1" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2" />
              </div>

              <button onClick={handleGoToPreview} className="w-full flex justify-center items-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-all font-medium">
                次へ（プレビュー） <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* --- STEP 2: プレビュー & 試聴 --- */}
        {step === 2 && (
          <div className="bg-white py-8 px-6 shadow rounded-lg sm:px-10 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Wand2 className="text-purple-500" /> AIによる構成チェック
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* テキスト表示エリア */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Original Text</label>
                <div className="p-4 bg-gray-50 rounded-md text-sm text-gray-700 h-40 overflow-y-auto border border-gray-200 whitespace-pre-wrap">{inputText}</div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-purple-600 uppercase flex justify-between">
                  AI Suggestion ({seconds}s)
                  {isAiLoading && <span className="animate-pulse">Processing...</span>}
                </label>
                <div className={`p-4 rounded-md text-sm h-40 overflow-y-auto whitespace-pre-wrap border ${isAiLoading ? 'bg-purple-50 text-purple-300' : 'bg-white border-purple-300 ring-2 ring-purple-50'}`}>
                  {isAiLoading ? <p className="text-center mt-10">AI処理中...</p> : aiRevisedText}
                </div>
              </div>
            </div>

            {/* 音声試聴エリア */}
            <div className="mt-8 pt-6 border-t border-gray-100 bg-gray-50 p-6 rounded-lg">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-4">
                <div className="w-full md:w-1/2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">音声パターン</label>
                  <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="block w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 sm:text-sm bg-white">
                    <option value="ja-JP-Neural2-B">女性アナウンサー (Neural2-B)</option>
                    <option value="ja-JP-Neural2-C">男性アナウンサー (Neural2-C)</option>
                    <option value="ja-JP-Neural2-D">男性ナレーター (Neural2-D)</option>
                  </select>
                </div>
                
                {/* 試聴ボタン */}
                <button
                  onClick={handlePreviewAudio}
                  disabled={isGeneratingAudio || isAiLoading}
                  className="w-full md:w-auto flex-1 flex justify-center items-center gap-2 py-2 px-6 bg-white border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 transition-all font-medium disabled:opacity-50"
                >
                  {isGeneratingAudio ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  ) : (
                    <Volume2 size={18} />
                  )}
                  {isGeneratingAudio ? '生成中...' : '音声を生成して試聴する'}
                </button>
              </div>

              {/* プレイヤー表示 */}
              {audioPreviewUrl && (
                <div className="mt-4 animate-fade-in text-center">
                  <audio controls src={audioPreviewUrl} className="w-full" />
                  <p className="text-xs text-gray-500 mt-2">※ この段階ではまだ保存されていません。内容が良ければ下のボタンで保存してください。</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <ArrowLeft size={16} /> 修正する
              </button>
              
              {/* ダウンロードボタン (試聴してから有効化) */}
              <button
                onClick={handleDownloadAndSave}
                disabled={!audioBlob || saveStatus === 'saved' || saveStatus === 'saving'}
                className={`flex-1 flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white transition-all ${
                  !audioBlob ? 'bg-gray-300 cursor-not-allowed' : 
                  saveStatus === 'saved' ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {saveStatus === 'saving' ? (
                  <>保存中...</>
                ) : saveStatus === 'saved' ? (
                  <><Check size={18} /> ダウンロード＆保存完了</>
                ) : (
                  <><Download size={18} /> ダウンロードして保存</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}