'use client';

import { Bold, Pause, Eraser } from 'lucide-react';

type EditorToolbarProps = {
    onInsert: (tagStart: string, tagEnd?: string) => void;
};

export const EditorToolbar = ({ onInsert }: EditorToolbarProps) => {
    return (
        <div className="flex items-center gap-2 mb-2">
            <button
                onClick={() => onInsert('<emphasis level="strong">', '</emphasis>')}
                className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-xs font-bold flex items-center gap-1 border border-gray-200"
                title="強く読む"
            >
                <Bold size={14} /> 強調
            </button>

            <button
                onClick={() => onInsert('<break time="0.5s" />')}
                className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-xs font-bold flex items-center gap-1 border border-gray-200"
                title="0.5秒の間"
            >
                <Pause size={14} /> 間(0.5s)
            </button>

            <button
                onClick={() => onInsert('<break time="1.0s" />')}
                className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors text-xs font-bold flex items-center gap-1 border border-gray-200"
                title="1.0秒の間"
            >
                <Pause size={14} /> 間(1.0s)
            </button>
        </div>
    );
};
