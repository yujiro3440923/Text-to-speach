'use client';

import { Music2 } from 'lucide-react';

type PitchSliderProps = {
    pitch: number;
    onChange: (val: number) => void;
};

export const PitchSlider = ({ pitch, onChange }: PitchSliderProps) => {
    // Pitch range: -5.0 to +5.0 (semitones approx in Google TTS)
    // Usually reliable range is -20.0 to +20.0, but let's stick to a safe meaningful range.
    // Google TTS 'pitch' is in semitones. 

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(parseFloat(e.target.value));
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Music2 size={16} className="text-indigo-600" />
                    声の高さ (Pitch)
                </label>
                <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-600">
                    {pitch > 0 ? `+${pitch}` : pitch}
                </span>
            </div>

            <div className="relative h-10 flex items-center">
                <input
                    type="range"
                    min="-5.0"
                    max="5.0"
                    step="0.5"
                    value={pitch}
                    onChange={handleChange}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full flex justify-between px-1 pointer-events-none">
                    <div className="w-0.5 h-2 bg-gray-300"></div> {/* Min */}
                    <div className="w-0.5 h-3 bg-gray-400"></div> {/* Center */}
                    <div className="w-0.5 h-2 bg-gray-300"></div> {/* Max */}
                </div>
            </div>

            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                <span>Low</span>
                <span>Standard</span>
                <span>High</span>
            </div>
        </div>
    );
};
