import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}

export function Combobox({ value, onChange, suggestions, placeholder }: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filtered suggestions
  const filtered = suggestions.filter(s =>
    s.toLowerCase().includes(inputValue.toLowerCase())
  );

  const updatePosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  const openDropdown = useCallback(() => {
    updatePosition();
    setIsOpen(true);
    setHighlightedIndex(-1);
  }, [updatePosition]);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const selectItem = useCallback((item: string) => {
    setInputValue(item);
    onChange(item);
    closeDropdown();
    inputRef.current?.blur();
  }, [onChange, closeDropdown]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        listRef.current &&
        !listRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, closeDropdown]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        openDropdown();
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => (i + 1) % filtered.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => (i - 1 + filtered.length) % filtered.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
          selectItem(filtered[highlightedIndex]);
        } else {
          closeDropdown();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v);
    setHighlightedIndex(-1);
    if (!isOpen && suggestions.length > 0) {
      updatePosition();
      setIsOpen(true);
    }
  };

  return (
    <div ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onFocus={suggestions.length > 0 ? openDropdown : undefined}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="fixed z-[100] max-h-60 overflow-y-auto bg-popover border rounded-md shadow-lg"
          style={{
            top: `${dropdownPos.top}px`,
            left: `${dropdownPos.left}px`,
            width: `${dropdownPos.width}px`,
          }}
        >
          {filtered.map((suggestion, index) => (
            <li
              key={suggestion}
              className={cn(
                'px-3 py-1.5 text-sm cursor-pointer',
                index === highlightedIndex
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted',
              )}
              onMouseDown={e => {
                e.preventDefault();
                selectItem(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
