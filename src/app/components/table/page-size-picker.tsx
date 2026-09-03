import type { IPageSizePickerOption } from './table-object';

interface PageSizePickerProps {
  isDisabled?: boolean;
  isHidden?: boolean;
  sizeOptions?: IPageSizePickerOption[];
  currentPageSize?: number;
  id?: string;
  onPageSizeChosen: (option: IPageSizePickerOption) => void;
}

export function PageSizePicker({
  isDisabled = false,
  isHidden = false,
  sizeOptions = [],
  currentPageSize,
  id,
  onPageSizeChosen,
}: PageSizePickerProps) {
  return (
    <div className="lib-page-size-display" hidden={isHidden} id={id}>
      {sizeOptions.map((sizeOption) => (
        <button
          key={sizeOption.value}
          className={`btn size-picker-option${sizeOption.value === currentPageSize ? ' current' : ''}`}
          onClick={() => onPageSizeChosen(sizeOption)}
          disabled={isDisabled}
          title={`Show ${sizeOption.value} records per page`}
        >
          {sizeOption.displayText}
        </button>
      ))}
    </div>
  );
}
