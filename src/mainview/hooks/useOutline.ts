import { useState, useCallback, useMemo } from 'react';
import type { OutlineNode } from '@/shared/types';

export interface UseOutlineReturn {
  headings: OutlineNode[];
  activeId: string | null;
  setHeadings: (markdown: string) => void;
  setActiveId: (id: string | null) => void;
}

export function useOutline(): UseOutlineReturn {
  const [headings, setHeadingsState] = useState<OutlineNode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const setHeadings = useCallback((markdown: string) => {
    const parsed = parseHeadings(markdown);
    setHeadingsState(buildHeadingTree(parsed));
  }, []);

  return {
    headings,
    activeId,
    setHeadings,
    setActiveId,
  };
}

// Parse markdown to extract headings
interface ParsedHeading {
  level: number;
  text: string;
  id: string;
  line: number;
}

function parseHeadings(markdown: string): ParsedHeading[] {
  const lines = markdown.split('\n');
  const headings: ParsedHeading[] = [];

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = generateHeadingId(text, index);
      headings.push({ level, text, id, line: index + 1 });
    }
  });

  return headings;
}

// Generate unique ID for heading
function generateHeadingId(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  return `${base}-${index}`;
}

// Build tree structure from flat headings
function buildHeadingTree(headings: ParsedHeading[]): OutlineNode[] {
  if (headings.length === 0) return [];

  const root: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const h of headings) {
    const node: OutlineNode = {
      id: h.id,
      level: h.level,
      text: h.text,
      line: h.line,
      children: [],
    };

    // Find parent
    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}
