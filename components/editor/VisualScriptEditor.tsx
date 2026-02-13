import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { PauseExtension } from './PauseExtension';
import { EmphasisExtension } from './EmphasisExtension';
import { ProsodyExtension } from './ProsodyExtension';
import { Bold, PauseCircle, Type, X } from 'lucide-react';

type VisualScriptEditorProps = {
    initialContent: string;
    onChange: (ssml: string) => void;
    className?: string;
};

export const VisualScriptEditor = ({ initialContent, onChange, className }: VisualScriptEditorProps) => {

    // Function to serialize Tiptap HTML to clean SSML
    // Tiptap's getHTML() returns standard HTML. We configured our extensions to render <break> and <emphasis>.
    // However, Tiptap might wrap things in <p>. SSML doesn't strictly need <p> but it allows it.
    // Google TTS supports <p> and <s> (sentence).
    // StarterKit uses Paragraph by default.

    const editor = useEditor({
        extensions: [
            StarterKit,
            PauseExtension,
            EmphasisExtension,
            ProsodyExtension,
        ],
        content: initialContent, // Tiptap tries to parse this as HTML. <break> and <emphasis> tags should be picked up by our extensions' parseHTML.
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg m-5 focus:outline-none min-h-[300px]',
            },
        },
        onUpdate: ({ editor }) => {
            // Get HTML
            let html = editor.getHTML();

            // Cleanup for SSML
            // Tiptap might add style attributes or classes we don't need, though our renderHTML handles tags.
            // We need to ensure output is valid SSML.
            // <p> check ok.
            // <span class="ssml-break-render"> -> we need just <break time="...">

            // Actually, Tiptap's renderHTML define what getHTML returns.
            // Our PauseExtension renders `['span', { class: 'ssml-break-render', time: ... }]` ?? 
            // Wait, renderHTML should return the tag we want in the output if we want getHTML to match?
            // No, renderHTML is for the editor DOM. 
            // To get specific "Export" format, we usually use a serializer or just regex replace the HTML.
            // Or we configure renderHTML to output <break> directly? Browsers might not like <break> tag visualization?
            // Actually modern browsers treat unknown tags as inline elements (like span).
            // So renderHTML returning `['break', ...]` might work and be visible if we style `break` in CSS.
            // BUT we used a NodeView for Pause. NodeView replaces the DOM rendering.
            // The `renderHTML` in extension definition is used for `getHTML()` serialization when NodeView is present?
            // Yes, if addNodeView is present, it's used for editor display. renderHTML is used for serialization.

            // So in PauseExtension.ts, renderHTML returning `span` means `getHTML()` returns `span`.
            // We should probably make renderHTML return `break` for serialization? 
            // But if we do that, we might break re-importing if we don't parse it right.
            // Actually, my parseHTML handles `break`.

            // Let's rely on regex cleanup for now to ensure strict SSML if needed, 
            // or ensure renderHTML in extensions outputs correct tags.
            // In PauseExtension, let's look at it again. 
            // It returns `['span', ...]` currently. I should change it to return `['break', ...]` if I want easy SSML.
            // But `break` is self-closing in XML/SSML `<break />`. HTML might treat it differently.
            // Let's stick to parsing the HTML output and converting to SSML conventions if needed, 
            // or just assume Google TTS is lenient with standard HTML tags if we map them?
            // Google TTS requires specific SSML tags. `<break>` not `<span>`.
            // So I will post-process the HTML string to convert the spans to breaks.

            // Replaces specific spans with break tags
            // We look for spans with class "ssml-break-render" and capture the "time" attribute value.
            // Regex explanation:
            // <span (any chars) class="ssml-break-render" (any chars) time="([^"]+)" (any chars) > (content) </span>
            // OR time comes first.

            // Easier strategy: Match the span tag open, check for class, extract time.
            // But JS regex is simplest with a robust pattern.
            // Pattern: <span[^>]*class="ssml-break-render"[^>]*time="([^"]+)"[^>]*><\/span> 
            // This assumes class comes before time. 
            // Let's use a two-step replace or a function replacer.

            // Let's match the whole block.
            html = html.replace(/<span[^>]*class="ssml-break-render"[^>]*>.*?<\/span>/g, (match) => {
                const timeMatch = match.match(/time=["']([^"']+)["']/);
                if (timeMatch) {
                    return `<break time="${timeMatch[1]}" />`;
                }
                return match;
            });

            // Emphasis: <emphasis class="ssml-emphasis">text</emphasis> -> <emphasis>text</emphasis>
            html = html.replace(/ class="ssml-emphasis"/g, '');

            // Prosody: <span data-ssml-pitch="high" style="...">text</span> -> <prosody pitch="+10%">text</prosody>
            // We use a general replacer for data-ssml attributes
            // Note: Tiptap might nest spans if we apply both pitch and volume.
            // <span data-ssml-pitch="high"><span data-ssml-volume="loud">text</span></span>
            // This replacement needs to be recursive or run multiple times?
            // Simple string replace might fail on nested tags if we are not careful.
            // But since we want to modify the *tag* itself, regex is okay if we target the opening tag and closing tag?
            // No, closing tag </span> is generic.

            // Better approach: Use a DOMParser to traverse and transform?
            // But we are in React/Browser client, so we can use DOMParser.
            // However, regex might be faster for simple replacements if structure is predictable.
            // Tiptap marks usually wrap text.

            // Let's try DOMParser for robustness.
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Convert spans with data-ssml-pitch/volume/rate to prosody tags
            const spans = doc.querySelectorAll('span[data-ssml-pitch], span[data-ssml-volume], span[data-ssml-rate]');
            spans.forEach(span => {
                const pitch = span.getAttribute('data-ssml-pitch');
                const volume = span.getAttribute('data-ssml-volume');
                // const rate = span.getAttribute('data-ssml-rate');

                // Create prosody element
                const prosody = doc.createElement('prosody');
                if (pitch) prosody.setAttribute('pitch', pitch === 'high' ? '+10%' : pitch === 'low' ? '-10%' : '0%');
                if (volume) prosody.setAttribute('volume', volume === 'loud' ? '+6dB' : volume === 'soft' ? '-6dB' : '0dB');

                // key: Move children to prosody
                while (span.firstChild) {
                    prosody.appendChild(span.firstChild);
                }

                // Replace span with prosody
                span.parentNode?.replaceChild(prosody, span);
            });

            // Serialize back to string
            // logic to unwrap <body>
            onChange(doc.body.innerHTML);
        },
    });

    if (!editor) {
        return null;
    }

    const addPause = (seconds: number) => {
        editor.chain().focus().insertContent({
            type: 'pause',
            attrs: { time: `${seconds}s` }
        }).run();
    };

    return (
        <div className={`flex flex-col border-2 rounded-xl overflow-hidden bg-white transition-all ${className}`}>
            {/* Toolbar - Sticky & Professional */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-2 flex items-center gap-2 flex-wrap shadow-sm">

                {/* Group: emphasis */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
                    <button
                        onClick={() => editor.chain().focus().toggleEmphasis().run()}
                        className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 text-xs font-bold ${editor.isActive('emphasis') ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
                        title="強調 (Bold)"
                    >
                        <Bold size={16} />
                        <span className="hidden sm:inline">強調</span>
                    </button>
                </div>

                <div className="w-px h-5 bg-gray-200 mx-1"></div>

                {/* Group: Tone (Pitch) */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
                    <span className="text-[10px] font-extrabold text-gray-400 px-1 uppercase tracking-wider">Tone</span>
                    <button
                        onClick={() => editor.chain().focus().setProsody({ pitch: 'high' }).run()}
                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${editor.isActive('prosody', { pitch: 'high' }) ? 'bg-rose-100 text-rose-700 shadow-sm ring-1 ring-rose-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
                        title="高く (High Pitch)"
                    >
                        High
                    </button>
                    <button
                        onClick={() => editor.chain().focus().setProsody({ pitch: 'low' }).run()}
                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${editor.isActive('prosody', { pitch: 'low' }) ? 'bg-teal-100 text-teal-700 shadow-sm ring-1 ring-teal-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
                        title="低く (Low Pitch)"
                    >
                        Low
                    </button>
                </div>

                {/* Group: Volume */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100">
                    <span className="text-[10px] font-extrabold text-gray-400 px-1 uppercase tracking-wider">Vol</span>
                    <button
                        onClick={() => editor.chain().focus().setProsody({ volume: 'loud' }).run()}
                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${editor.isActive('prosody', { volume: 'loud' }) ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-gray-600 hover:bg-gray-200/50'}`}
                        title="大きく (Loud)"
                    >
                        Loud
                    </button>
                    <button
                        onClick={() => editor.chain().focus().setProsody({ volume: 'soft' }).run()}
                        className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${editor.isActive('prosody', { volume: 'soft' }) ? 'bg-gray-200 text-gray-700 shadow-sm ring-1 ring-gray-300' : 'text-gray-600 hover:bg-gray-200/50'}`}
                        title="小さく (Soft)"
                    >
                        Soft
                    </button>
                </div>

                <div className="w-px h-5 bg-gray-200 mx-1"></div>

                <button
                    onClick={() => editor.chain().focus().unsetProsody().run()}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="書式をクリア"
                >
                    <X size={16} />
                </button>

                <div className="flex-1"></div>

                {/* Group: Pause */}
                <div className="flex items-center gap-1 bg-amber-50 rounded-lg p-1 border border-amber-100">
                    <span className="text-[10px] font-extrabold text-amber-500/70 px-1 uppercase tracking-wider">Break</span>
                    <button
                        onClick={() => addPause(0.5)}
                        className="p-1.5 rounded-md hover:bg-amber-100 text-amber-700 transition-colors flex items-center gap-1 text-xs font-bold"
                        title="間 (0.5s)"
                    >
                        <PauseCircle size={14} /> 0.5s
                    </button>
                    <button
                        onClick={() => addPause(1.0)}
                        className="p-1.5 rounded-md hover:bg-amber-100 text-amber-700 transition-colors flex items-center gap-1 text-xs font-bold"
                        title="間 (1.0s)"
                    >
                        <PauseCircle size={14} /> 1.0s
                    </button>
                </div>
            </div>

            {/* Editor Content */}
            <EditorContent editor={editor} className="flex-1 overflow-y-auto cursor-text" />

            {/* Footer / Status */}
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                <span>SSML Visual Editor</span>
                <span>{editor.storage.characterCount?.characters?.() || 0} chars</span>
            </div>

            {/* Global Style for Editor Content */}
            <style jsx global>{`
        .ProseMirror {
          min-height: 100%;
          outline: none;
          padding: 1rem;
        }
        .ProseMirror p {
          margin-bottom: 0.5em;
        }
        /* Emphasis Style */
        .ssml-emphasis {
           font-size: 1.25em;
           font-weight: 900;
           color: #4f46e5; /* Indigo 600 */
           background-color: #eef2ff;
           padding: 0 4px;
           border-radius: 4px;
        }
      `}</style>
        </div>
    );
};
