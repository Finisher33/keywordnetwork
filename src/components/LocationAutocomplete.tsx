import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { KOREAN_DISTRICTS } from '../constants/districts';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function LocationAutocomplete({ 
  value, 
  onChange, 
  placeholder = "근무지를 입력하세요",
  className = "",
  disabled = false
}: LocationAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);

    if (val.trim().length > 0) {
      const filtered = KOREAN_DISTRICTS.filter(d => 
        d.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 10); // Limit to 10 suggestions
      setSuggestions(filtered);
      setIsOpen(true);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (suggestion: string) => {
    setInputValue(suggestion);
    onChange(suggestion);
    setIsOpen(false);
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => inputValue.trim().length > 0 && setIsOpen(true)}
            disabled={disabled}
            placeholder={placeholder} 
            className="bg-transparent border-none p-0 w-full focus:ring-0 text-on-surface text-sm placeholder:text-on-surface-variant/50 outline-none"
          />
        </div>
        <p className="text-[10px] text-on-surface-variant font-medium px-0.5">
          * 시 단위는 "구" 단위까지, 도 단위는 "시 또는 군"까지 입력해 주세요.
        </p>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-[100] left-0 right-0 mt-2 bg-surface border border-outline rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto no-scrollbar">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-4 py-3 text-sm hover:bg-primary/10 text-on-surface transition-colors border-b border-outline last:border-none"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
