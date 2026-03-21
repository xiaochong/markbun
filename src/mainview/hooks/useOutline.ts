import { useState, useCallback, useRef, useEffect } from 'react';
import type { OutlineNode } from '@/shared/types';
import { debounce } from '@/lib/utils';

const DEBOUNCE_DELAY = 300;
const LARGE_FILE_LINE_THRESHOLD = 1000;

export interface UseOutlineReturn {
  headings: OutlineNode[];
  activeId: string | null;
  setHeadings: (markdown: string) => void;
  setActiveId: (id: string | null) => void;
}

export function useOutline(): UseOutlineReturn {
  const [headings, setHeadingsState] = useState<OutlineNode[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pendingMarkdownRef = useRef<string | null>(null);

  // Debounced parsing for large files to avoid blocking input
  const debouncedParse = useRef(
    debounce((markdown: string) => {
      const parsed = parseHeadingsOptimized(markdown);
      setHeadingsState(buildHeadingTree(parsed));
    }, DEBOUNCE_DELAY)
  ).current;

  const setHeadings = useCallback((markdown: string) => {
    const lineCount = markdown.split('\n').length;

    // For small files, parse immediately
    // For large files, use debounced parsing to avoid blocking
    if (lineCount < LARGE_FILE_LINE_THRESHOLD) {
      const parsed = parseHeadingsOptimized(markdown);
      setHeadingsState(buildHeadingTree(parsed));
    } else {
      // Debounce for large files during editing
      pendingMarkdownRef.current = markdown;
      debouncedParse(markdown);
    }
  }, [debouncedParse]);

  // Clean up pending debounce on unmount
  useEffect(() => {
    return () => {
      debouncedParse.cancel?.();
    };
  }, [debouncedParse]);

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

// Optimized parser with fast skip for non-heading lines
function parseHeadingsOptimized(markdown: string): ParsedHeading[] {
  const lines = markdown.split('\n');
  const headings: ParsedHeading[] = [];
  const totalLines = lines.length;
  let inCodeBlock = false;

  for (let i = 0; i < totalLines; i++) {
    const line = lines[i];

    // Track fenced code blocks (``` or ~~~)
    if (line.trimStart().startsWith('```') || line.trimStart().startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip lines inside code blocks
    if (inCodeBlock) continue;

    // Fast skip: headings must start with #
    if (line.length === 0 || line[0] !== '#') continue;

    // Check for valid heading pattern
    let level = 0;
    while (level < line.length && level < 6 && line[level] === '#') {
      level++;
    }

    // Must have space after #s
    if (level === 0 || level >= line.length || line[level] !== ' ') continue;

    // Extract text (skip the #s and the space)
    const text = line.slice(level + 1).trim();
    if (text.length === 0) continue;

    const id = generateHeadingId(text, i);
    headings.push({ level, text, id, line: i + 1 });
  }

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
