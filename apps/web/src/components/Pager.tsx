import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
};

// The page numbers to show: always the first and last, the current one and its neighbours,
// with a gap ("…") where pages are left out. For example 1 … 4 5 6 … 12.
function pageNumbers(page: number, pageCount: number): (number | "gap")[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])]
    .filter((number) => number >= 1 && number <= pageCount)
    .sort((first, second) => first - second);

  const result: (number | "gap")[] = [];
  for (const number of shown) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && number - previous === 2) result.push(previous + 1);
    else if (typeof previous === "number" && number - previous > 2) result.push("gap");
    result.push(number);
  }
  return result;
}

// Numbered pages under a list, with previous and next. Hidden when everything fits on one page.
export function Pager({ page, pageSize, total, onChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount === 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="pager" aria-label="Pages">
      <span className="small muted">Showing {first}–{last} of {total}</span>
      <div className="pager-pages">
        <button className="btn btn-g btn-ic" aria-label="Previous page" disabled={page === 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        {pageNumbers(page, pageCount).map((number, index) =>
          number === "gap" ? (
            <span className="pager-gap" key={`gap-${index}`} aria-hidden="true">…</span>
          ) : (
            <button
              key={number}
              className={`btn btn-ic ${number === page ? "btn-p" : "btn-g"}`}
              aria-label={`Page ${number}`}
              aria-current={number === page ? "page" : undefined}
              onClick={() => onChange(number)}
            >
              {number}
            </button>
          ),
        )}
        <button className="btn btn-g btn-ic" aria-label="Next page" disabled={page === pageCount} onClick={() => onChange(page + 1)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
