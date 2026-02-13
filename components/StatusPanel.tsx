'use client';

import { Gauge, Check, Zap } from 'lucide-react';
import { STANDARD_CHARS_PER_SEC } from '@/lib/audioUtils';

type StatusPanelProps = {
    currentText: string;
    targetSeconds: number;
};

export const StatusPanel = ({ currentText, targetSeconds }: StatusPanelProps) => {
    const currentCharCount = currentText.length;
    // Use constant from shared lib if possible, but for client component importing from lib is fine if it's pure JS/TS
    // Ensure lib/audioUtils.ts is client-compatible (it is).
    const idealCharCount = Math.floor(targetSeconds * STANDARD_CHARS_PER_SEC);
    const diffCount = idealCharCount - currentCharCount;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 transition-all shadow-sm">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600 shadow-sm">
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
                {Math.abs(diffCount) < 5 ? <Check size={16} /> : <Zap size={16} />}
                {Math.abs(diffCount) < 5 ? 'ピッタリです！ (±5文字)' : diffCount > 0
                    ? `あと ${diffCount} 文字足りません`
                    : `${Math.abs(diffCount)} 文字多いです`
                }
            </div>
        </div>
    );
};
