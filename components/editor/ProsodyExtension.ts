import { Mark, mergeAttributes } from '@tiptap/core';

export interface ProsodyOptions {
    HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        prosody: {
            setProsody: (attributes: { pitch?: string; volume?: string; rate?: string }) => ReturnType;
            unsetProsody: () => ReturnType;
        };
    }
}

export const ProsodyExtension = Mark.create<ProsodyOptions>({
    name: 'prosody',

    addOptions() {
        return {
            HTMLAttributes: {},
        };
    },

    addAttributes() {
        return {
            pitch: {
                default: null,
                parseHTML: element => element.getAttribute('pitch'),
                renderHTML: attributes => {
                    if (!attributes.pitch) {
                        return {};
                    }
                    return {
                        'data-ssml-pitch': attributes.pitch,
                        style: `color: ${attributes.pitch === 'high' ? '#e11d48' : '#0f766e'}; font-style: italic;`, // Visual feedback: Red for high, Teal for low
                    };
                },
            },
            volume: {
                default: null,
                parseHTML: element => element.getAttribute('volume'),
                renderHTML: attributes => {
                    if (!attributes.volume) {
                        return {};
                    }
                    return {
                        'data-ssml-volume': attributes.volume,
                        style: `font-size: ${attributes.volume === 'loud' ? '1.2em' : '0.8em'};`, // Visual feedback
                    };
                },
            },
            rate: {
                default: null,
                parseHTML: element => element.getAttribute('rate'),
                renderHTML: attributes => {
                    if (!attributes.rate) return {};
                    return {
                        'data-ssml-rate': attributes.rate,
                    };
                }
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-ssml-pitch]',
            },
            {
                tag: 'span[data-ssml-volume]',
            },
            {
                tag: 'prosody', // For re-importing actual SSML if we ever do that
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setProsody:
                attributes =>
                    ({ commands }) => {
                        return commands.setMark(this.name, attributes);
                    },
            unsetProsody:
                () =>
                    ({ commands }) => {
                        return commands.unsetMark(this.name);
                    },
        };
    },
});
