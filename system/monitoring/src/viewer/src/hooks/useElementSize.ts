import { useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
    width: number;
    height: number;
}

/**
 * Custom hook: tracks an element's rendered size via ResizeObserver so
 * consumers can scale their output to fill the renderable area.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize | null {
    const [size, setSize] = useState<ElementSize | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (rect) setSize({ width: rect.width, height: rect.height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);

    return size;
}
