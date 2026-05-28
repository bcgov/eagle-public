import { Component, input, output, forwardRef, signal, computed, OnInit, OnDestroy, ElementRef, inject } from '@angular/core';

import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type CustomMultiSelectOption = Record<string, any>;

export interface CustomMultiSelectGroup {
  name: string;
  items: CustomMultiSelectOption[];
}

@Component({
  selector: 'app-custom-multi-select',
  templateUrl: './custom-multi-select.component.html',
  styleUrls: ['./custom-multi-select.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomMultiSelectComponent),
      multi: true
    }
  ],
  imports: [FormsModule]
})
export class CustomMultiSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  private elementRef = inject(ElementRef);
  
  id = input('');
  name = input('');
  items = input<CustomMultiSelectOption[]>([]);
  bindLabel = input('label');
  groupBy = input<string | null>(null);
  placeholder = input('Select items');
  multiple = input(true);
  markFirst = input(false);
  closeOnSelect = input(false);
  compareWith = input<(item: any, selected: any) => boolean>((a, b) => a === b);
  
  add = output<CustomMultiSelectOption>();
  remove = output<CustomMultiSelectOption>();
  clear = output<void>();

  // Internal state
  isOpen = signal(false);
  searchTerm = signal('');
  selectedItems = signal<CustomMultiSelectOption[]>([]);
  focusedIndex = signal(-1);
  
  // Filtered and grouped items
  filteredItems = computed(() => {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.items();
    
    return this.items().filter(item => {
      const label = this.getLabel(item).toLowerCase();
      return label.includes(term);
    });
  });

  groupedItems = computed(() => {
    const filtered = this.filteredItems();
    
    if (!this.groupBy()) {
      return [{ name: '', items: filtered }];
    }
    
    const groups = new Map<string, CustomMultiSelectOption[]>();
    
    filtered.forEach(item => {
      const groupValue = item[this.groupBy()!] || '';
      if (!groups.has(groupValue)) {
        groups.set(groupValue, []);
      }
      groups.get(groupValue)!.push(item);
    });
    
    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  });

  // ControlValueAccessor
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onChange: any = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private onTouched: any = () => {};
  disabled = false;

  writeValue(value: any): void {
    this.selectedItems.set(value || []);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Helper methods
  getLabel(item: CustomMultiSelectOption): string {
    return item[this.bindLabel()] || '';
  }

  isSelected(item: CustomMultiSelectOption): boolean {
    return this.selectedItems().some(selected => 
      this.compareWith()(item, selected)
    );
  }

  toggleDropdown(): void {
    if (this.disabled) return;
    this.isOpen.set(!this.isOpen());
    if (this.isOpen()) {
      this.focusedIndex.set(-1);
      setTimeout(() => {
        const searchInput = document.querySelector('.custom-multi-select__search') as HTMLInputElement;
        searchInput?.focus();
      }, 0);
    } else {
      this.searchTerm.set('');
      this.onTouched();
    }
  }

  selectItem(item: CustomMultiSelectOption, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (this.isSelected(item)) {
      this.deselectItem(item);
    } else {
      const newSelected = [...this.selectedItems(), item];
      this.selectedItems.set(newSelected);
      this.onChange(newSelected);
      this.add.emit(item);
      
      if (this.closeOnSelect()) {
        this.isOpen.set(false);
      }
    }
    
    this.searchTerm.set('');
    this.focusedIndex.set(-1);
  }

  deselectItem(item: CustomMultiSelectOption): void {
    const newSelected = this.selectedItems().filter(selected => 
      !this.compareWith()(item, selected)
    );
    this.selectedItems.set(newSelected);
    this.onChange(newSelected);
    this.remove.emit(item);
  }

  clearAll(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedItems.set([]);
    this.onChange([]);
    this.clear.emit();
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
    this.focusedIndex.set(-1);
  }

  // Keyboard navigation
  onKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(-1);
        break;
      case 'Enter':
        event.preventDefault();
        if (this.focusedIndex() >= 0) {
          const flatItems = this.getFlatItems();
          const item = flatItems[this.focusedIndex()];
          if (item) {
            this.selectItem(item);
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.isOpen.set(false);
        this.searchTerm.set('');
        break;
    }
  }

  private moveFocus(direction: number): void {
    const flatItems = this.getFlatItems();
    const maxIndex = flatItems.length - 1;
    let newIndex = this.focusedIndex() + direction;
    
    if (newIndex < 0) newIndex = 0;
    if (newIndex > maxIndex) newIndex = maxIndex;
    
    this.focusedIndex.set(newIndex);
    
    // Scroll into view
    setTimeout(() => {
      const focusedElement = document.querySelector('.custom-multi-select__option--focused');
      focusedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
  }

  private getFlatItems(): CustomMultiSelectOption[] {
    return this.groupedItems().flatMap(group => group.items);
  }

  getItemIndex(item: CustomMultiSelectOption): number {
    const flatItems = this.getFlatItems();
    return flatItems.findIndex(i => this.compareWith()(i, item));
  }

  // Click outside handler
  onDocumentClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const hostElement = this.elementRef.nativeElement;
    if (hostElement && !hostElement.contains(target)) {
      this.isOpen.set(false);
      this.searchTerm.set('');
    }
  };

  ngOnInit(): void {
    document.addEventListener('click', this.onDocumentClick);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onDocumentClick);
  }
}
