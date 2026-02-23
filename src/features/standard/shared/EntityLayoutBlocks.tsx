import type { ReactNode } from "react";

interface EntityLayoutProps {
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}

interface ListControlsProps {
  filter: ReactNode;
  sort: ReactNode;
}

interface ListPaginationProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

interface DateRangeFilterProps {
  from: string;
  to: string;
  invalid: boolean;
  onFromChange: (next: string) => void;
  onToChange: (next: string) => void;
  onClear: () => void;
}

export function EntityLayout({ ariaLabel, className, children }: EntityLayoutProps) {
  return (
    <section className={`entity-layout${className ? ` ${className}` : ""}`} aria-label={ariaLabel}>
      {children}
    </section>
  );
}

export function ListControls({ filter, sort }: ListControlsProps) {
  return (
    <div className="list-controls">
      <div className="list-controls-main-row">
        <div className="list-filter-group">{filter}</div>
        <div className="list-sort-group">{sort}</div>
      </div>
    </div>
  );
}

export function ListPagination({ currentPage, totalPages, onPrev, onNext }: ListPaginationProps) {
  return (
    <div className="list-pagination">
      <button className="list-pagination-button" onClick={onPrev} type="button" disabled={currentPage <= 1}>
        Prev
      </button>
      <span className="list-pagination-status">{`Page ${currentPage} / ${totalPages}`}</span>
      <button className="list-pagination-button" onClick={onNext} type="button" disabled={currentPage >= totalPages}>
        Next
      </button>
    </div>
  );
}

export function DateRangeFilter({ from, to, invalid, onFromChange, onToChange, onClear }: DateRangeFilterProps) {
  return (
    <>
      <label className="list-filter-field">
        <span>From</span>
        <input
          className={`list-filter-input${invalid ? " is-invalid" : ""}`}
          type="date"
          value={from}
          onChange={(event) => onFromChange(event.currentTarget.value)}
        />
      </label>
      <label className="list-filter-field">
        <span>To</span>
        <input
          className={`list-filter-input${invalid ? " is-invalid" : ""}`}
          type="date"
          value={to}
          onChange={(event) => onToChange(event.currentTarget.value)}
        />
      </label>
      <button className="list-clear-button" onClick={onClear} type="button">
        Clear
      </button>
    </>
  );
}
