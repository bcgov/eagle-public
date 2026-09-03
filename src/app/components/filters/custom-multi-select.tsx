import { useEffect, useMemo, useRef, useState } from 'react';

export type CustomMultiSelectOption = Record<string, any>;

interface CustomMultiSelectProps {
  id?: string;
  items: CustomMultiSelectOption[];
  selected: CustomMultiSelectOption[];
  bindLabel?: string;
  groupBy?: string | null;
  placeholder?: string;
  disabled?: boolean;
  onChange: (selected: CustomMultiSelectOption[]) => void;
}

/** Same identity rules the Angular comparator used: `code`, then `_id`, then the value itself. */
function sameOption(item: any, other: any): boolean {
  if (item && other && Object.hasOwn(item, 'code')) return item.code === other.code;
  if (item && other && Object.hasOwn(item, '_id')) return item._id === other._id;
  return item === other;
}

export function CustomMultiSelect({
  id = '',
  items,
  selected,
  bindLabel = 'label',
  groupBy = null,
  placeholder = 'Select items',
  disabled = false,
  onChange,
}: CustomMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onDocumentClick(event: MouseEvent): void {
      if (hostRef.current && !hostRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [isOpen]);

  const getLabel = (item: CustomMultiSelectOption): string => item[bindLabel] || '';

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    if (!term) return items;
    return items.filter((item) => (item[bindLabel] || '').toLowerCase().includes(term));
  }, [items, searchTerm, bindLabel]);

  const groupedItems = useMemo(() => {
    if (!groupBy) {
      return [{ name: '', items: filteredItems }];
    }
    const groups = new Map<string, CustomMultiSelectOption[]>();
    for (const item of filteredItems) {
      const groupValue = item[groupBy] || '';
      if (!groups.has(groupValue)) groups.set(groupValue, []);
      groups.get(groupValue)!.push(item);
    }
    return Array.from(groups.entries()).map(([name, groupItems]) => ({ name, items: groupItems }));
  }, [filteredItems, groupBy]);

  const flatItems = useMemo(() => groupedItems.flatMap((group) => group.items), [groupedItems]);

  const isSelected = (item: CustomMultiSelectOption): boolean =>
    selected.some((entry) => sameOption(item, entry));

  function toggleDropdown(): void {
    if (disabled) return;
    setIsOpen((open) => !open);
    setFocusedIndex(-1);
    setSearchTerm('');
  }

  function selectItem(item: CustomMultiSelectOption): void {
    if (isSelected(item)) {
      onChange(selected.filter((entry) => !sameOption(item, entry)));
    } else {
      onChange([...selected, item]);
    }
    setSearchTerm('');
    setFocusedIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((index) => Math.min(flatItems.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex((index) => Math.max(0, index - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const item = flatItems[focusedIndex];
        if (item) selectItem(item);
        break;
      }
      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  }

  return (
    <div
      ref={hostRef}
      id={id}
      className={`custom-multi-select${isOpen ? ' custom-multi-select--open' : ''}${
        disabled ? ' custom-multi-select--disabled' : ''
      }`}
    >
      <div
        className="custom-multi-select__control"
        onClick={toggleDropdown}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleDropdown();
          }
        }}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`${id}-listbox`}
        aria-label={placeholder}
      >
        {selected.length > 0 ? (
          <div className="custom-multi-select__values">
            {selected.map((item, index) => (
              <div
                className="custom-multi-select__value"
                key={item['_id'] ?? item['code'] ?? index}
              >
                <span className="custom-multi-select__value-label">{getLabel(item)}</span>
                {groupBy && item[groupBy] && (
                  <span className="custom-multi-select__value-group">({item[groupBy]})</span>
                )}
                <button
                  type="button"
                  className="custom-multi-select__value-remove"
                  onClick={(event) => {
                    event.stopPropagation();
                    onChange(selected.filter((entry) => !sameOption(item, entry)));
                  }}
                  aria-label={`Remove ${getLabel(item)}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <span className="custom-multi-select__placeholder">{placeholder}</span>
        )}

        {selected.length > 0 && (
          <button
            type="button"
            className="custom-multi-select__clear"
            onClick={(event) => {
              event.stopPropagation();
              onChange([]);
            }}
            aria-label="Clear all selections"
          >
            ×
          </button>
        )}

        <span
          className={`custom-multi-select__arrow${isOpen ? ' custom-multi-select__arrow--up' : ''}`}
        >
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {isOpen && (
        <div
          className="custom-multi-select__dropdown"
          id={`${id}-listbox`}
          role="listbox"
          aria-label={`Options for ${placeholder}`}
        >
          <div className="custom-multi-select__search-wrapper">
            <input
              type="text"
              className="custom-multi-select__search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setFocusedIndex(-1);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search..."
              aria-label="Search options"
              autoFocus
            />
          </div>

          <div className="custom-multi-select__options">
            {filteredItems.length === 0 && (
              <div className="custom-multi-select__no-results">No items found</div>
            )}

            {groupedItems.map((group) =>
              group.items.length === 0 ? null : (
                <div key={group.name}>
                  {groupBy && group.name && (
                    <div className="custom-multi-select__group-header">{group.name}</div>
                  )}
                  {group.items.map((item) => (
                    <div
                      key={item['_id'] ?? item['code'] ?? getLabel(item)}
                      className={`custom-multi-select__option${
                        isSelected(item) ? ' custom-multi-select__option--selected' : ''
                      }${flatItems[focusedIndex] === item ? ' custom-multi-select__option--focused' : ''}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectItem(item);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          selectItem(item);
                        }
                      }}
                      tabIndex={0}
                      role="option"
                      aria-selected={isSelected(item)}
                    >
                      <span className="custom-multi-select__checkbox">
                        {isSelected(item) && (
                          <svg
                            width="12"
                            height="10"
                            viewBox="0 0 12 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M1 5L4.5 8.5L11 1.5"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="custom-multi-select__option-label">{getLabel(item)}</span>
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
