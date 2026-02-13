'use client';

import { Gauge, Check, Zap, AlertTriangle, Clock } from 'lucide-react';

type StatusPanelProps = {
    currentText: string;
    targetSeconds: number;
};

export const StatusPanel = ({ currentText, targetSeconds }: StatusPanelProps) => {
    // Logic: 
    // 1. Calculate Estimated "Natural" Duration (at 1.0x speed)
    //    Assumption: Japanese ~5.5 chars/sec is standard logic in audioUtils too.
    const cleanText = currentText.replace(/<[^>]*>/g, '').replace(/\s/g, '');
    const charCount = cleanText.length;
    const estimatedNaturalDuration = charCount / 5.5; // Seconds

    // 2. Calculate Required Speed to fit Target
    //    Rate = Natural / Target
    //    Avoid division by zero
    const requiredRate = targetSeconds > 0 ? estimatedNaturalDuration / targetSeconds : 1.0;

    // 3. Determine Health
    //    0.85 - 1.15 : Good (Green)
    //    0.70 - 1.30 : Warning (Yellow) - Too slow or Too fast
    //    Otherwise   : Critical (Red) - Unnatural

    let statusColor = 'bg-red-50 text-red-700 border-red-200';
    let statusIcon = <AlertTriangle size={18} />;
    let message = '速度調整が必要です';
    let speedLabel = '不自然な速度';

    if (currentText.length === 0) {
        statusColor = 'bg-gray-50 text-gray-500 border-gray-200';
        statusIcon = <Clock size={18} />;
        message = '原稿を入力してください';
        speedLabel = '-';
    } else if (requiredRate >= 0.85 && requiredRate <= 1.15) {
        statusColor = 'bg-green-50 text-green-700 border-green-200';
        statusIcon = <Check size={18} />;
        message = '自然な速度です';
        speedLabel = '理想的';
    } else if (requiredRate >= 0.7 && requiredRate <= 1.3) {
        statusColor = 'bg-yellow-50 text-yellow-700 border-yellow-200';
        statusIcon = <Zap size={18} />;
        message = requiredRate > 1 ? '少し早口になります' : '少しゆっくりになります';
        speedLabel = '許容範囲';
    } else {
        statusColor = 'bg-red-50 text-red-700 border-red-200';
        statusIcon = <AlertTriangle size={18} />;
        message = requiredRate > 1 ? 'かなり早口になります' : 'かなり間延びします';
        speedLabel = '要調整';
    }

    const displayedRate = Math.round(requiredRate * 100) / 100;

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col items-stretch gap-4 transition-all">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">

                {/* Estimated Time */}
                <div className="flex items-center gap-4 flex-1">
                    <div className="bg-indigo-50 p-3 rounded-full text-indigo-600 shadow-sm">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">標準速度での所要時間</p>
                        <p className="text-2xl font-bold text-gray-900 flex items-baseline gap-1">
                            {estimatedNaturalDuration.toFixed(1)} <span className="text-sm font-medium text-gray-500">秒</span>
                        </p>
                    </div>
                </div>

                <div className="hidden md:block w-px h-12 bg-gray-200"></div>

                {/* Required Speed */}
                <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-full shadow-sm ${requiredRate > 1.15 || requiredRate < 0.85 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                        <Gauge size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">目標({targetSeconds}秒)に必要な速度</p>
                        <p className={`text-2xl font-bold flex items-baseline gap-1 ${requiredRate > 1.3 || requiredRate < 0.7 ? 'text-red-600' : 'text-gray-900'}`}>
                            x{targetSeconds > 0 ? (Math.round(requiredRate * 100) / 100).toFixed(2) : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Status Bar */}
            <div className={`mt-2 px-4 py-3 rounded-lg border flex items-center justify-between font-bold text-sm ${statusColor}`}>
                <div className="flex items-center gap-2">
                    {statusIcon}
                    <span>{message}</span>
                </div>
                <span className="bg-white/50 px-2 py-0.5 rounded text-xs uppercase tracking-wider border border-black/5">
                    {speedLabel}
                </span>
            </div>
        </div>
    );
};
