import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useState, useRef, useEffect } from 'react';

// --- Component for the Node View ---
const PauseComponent = (props: any) => {
    const [duration, setDuration] = useState(parseFloat(props.node.attrs.time));
    const [isDragging, setIsDragging] = useState(false);
    const startXRef = useRef(0);
    const startDurationRef = useRef(0);

    // Sync internal state if external update happens
    useEffect(() => {
        setDuration(parseFloat(props.node.attrs.time));
    }, [props.node.attrs.time]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        startXRef.current = e.clientX;
        startDurationRef.current = duration;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startXRef.current;
        // Sensitivity: 100px = 1.0s
        const deltaSeconds = deltaX / 100;

        let newDuration = startDurationRef.current + deltaSeconds;
        // Clamp: Min 0.1s, Max 5.0s
        if (newDuration < 0.1) newDuration = 0.1;
        if (newDuration > 5.0) newDuration = 5.0;

        setDuration(newDuration);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // Commit change to Tiptap Use state value not ref
        // We need to get the latest duration from state, but inside event listener state might be stale if not careful.
        // Actually handleMouseMove updates state, so on MouseUp we should use the state... 
        // BUT React state update is async.
        // Let's use a ref for the *current* value to be safe during drag, or just use the last calculated value.
        // Better: update attributes on every move? No, performace.
        // Let's update attributes on mouse up.
    };

    // Update attributes when drag ends
    useEffect(() => {
        if (!isDragging) {
            props.updateAttributes({ time: duration.toFixed(1) + 's' });
        }
    }, [isDragging, duration, props]);

    // Visual Width: 1s = 60px
    const width = Math.max(40, duration * 60);

    return (
        <NodeViewWrapper className="inline-block align-middle mx-1 select-none">
            <div
                className={`flex items-center justify-center rounded-md border-2 transition-colors cursor-col-resize relative overflow-hidden ${isDragging ? 'border-indigo-600 bg-indigo-100' : 'border-gray-300 bg-gray-50 hover:border-indigo-400'
                    }`}
                style={{ width: `${width}px`, height: '28px' }}
                onMouseDown={handleMouseDown}
            >
                <span className="text-xs font-bold text-gray-600 pointer-events-none select-none">
                    {duration.toFixed(1)}s
                </span>

                {/* Visual handle indicator */}
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-black/5 hover:bg-black/10"></div>
            </div>
        </NodeViewWrapper>
    );
};

// --- Extension Definition ---
export const PauseExtension = Node.create({
    name: 'pause',

    group: 'inline',
    inline: true,
    atom: true, // It is a single unit, cursor cannot go inside

    addAttributes() {
        return {
            time: {
                default: '0.5s',
                parseHTML: element => element.getAttribute('time'),
                renderHTML: attributes => {
                    return {
                        'time': attributes.time,
                        'class': 'ssml-break' // helper class
                    }
                },
            },
        }
    },

    parseHTML() {
        return [
            {
                tag: 'break',
            },
            {
                tag: 'span',
                getAttrs: (node: HTMLElement) => node.classList.contains('ssml-break') && null,
            }
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { class: 'ssml-break-render' }), '']
    },

    addNodeView() {
        return ReactNodeViewRenderer(PauseComponent)
    },
});
