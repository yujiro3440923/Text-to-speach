'use client';

import { useRef, useEffect } from 'react';

type TimePickerProps = {
    seconds: number;
    onChange: (val: number) => void;
};

export const TimePicker = ({ seconds, onChange }: TimePickerProps) => {
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
    }, []); // 初回のみ, 依存配列を空にしてマウント時のみ実行

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
