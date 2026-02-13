import { Mark, mergeAttributes } from '@tiptap/core';

export const EmphasisExtension = Mark.create({
    name: 'emphasis',

    parseHTML() {
        return [
            {
                tag: 'emphasis',
            },
            {
                tag: 'strong', // Map strong to emphasis as well for ease
            },
            {
                style: 'font-weight=bold',
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['emphasis', mergeAttributes(HTMLAttributes, { class: 'ssml-emphasis' }), 0]
    },

    addCommands() {
        return {
            toggleEmphasis: () => ({ commands }) => {
                return commands.toggleMark(this.name)
            },
            setEmphasis: () => ({ commands }) => {
                return commands.setMark(this.name)
            },
            unsetEmphasis: () => ({ commands }) => {
                return commands.unsetMark(this.name)
            },
        }
    },

    // Define keyboard shortcuts
    addKeyboardShortcuts() {
        return {
            'Mod-b': () => this.editor.commands.toggleEmphasis(),
        }
    },
});

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        emphasis: {
            /**
             * Toggle emphasis
             */
            toggleEmphasis: () => ReturnType,
            /**
             * Set emphasis
             */
            setEmphasis: () => ReturnType,
            /**
             * Unset emphasis
             */
            unsetEmphasis: () => ReturnType,
        }
    }
}
