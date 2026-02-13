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
                    const isHigh = attributes.pitch === 'high';
                    return {
                        'data-ssml-pitch': attributes.pitch,
                        style: `
                background-color: ${isHigh ? '#ffe4e6' : '#ccfbf1'};
                color: ${isHigh ? '#be123c' : '#0f766e'};
                padding: 1px 4px;
                border-radius: 4px;
                border: 1px solid ${isHigh ? '#fda4af' : '#5eead4'};
                font-size: 0.85em;
                font-weight: 600;
                vertical-align: middle;
                margin: 0 1px;
            `,
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
                    const isLoud = attributes.volume === 'loud';
                    return {
                        'data-ssml-volume': attributes.volume,
                        style: `
                background-color: ${isLoud ? '#e0e7ff' : '#f3f4f6'};
                color: ${isLoud ? '#4338ca' : '#6b7280'};
                padding: 1px 4px;
                border-radius: 4px;
                border: 1px solid ${isLoud ? '#a5b4fc' : '#d1d5db'};
                font-size: ${isLoud ? '1em' : '0.85em'};
                font-weight: 600;
                vertical-align: middle;
                 margin: 0 1px;
            `,
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
