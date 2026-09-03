import { useMemo } from 'react';
import { NavLink, useSearchParams } from 'react-router';
import { HeroBanner } from 'app/components/hero-banner';
import { SearchFilterTemplate } from 'app/components/filters/search-filter-template';
import type { SearchPackage } from 'app/components/filters/filter-object';
import { Pagination } from 'app/components/table/pagination';
import { paramsToObject, toSearchParams, type Params } from 'app/components/table/table-params';
import { useTable } from 'app/components/table/use-table';
import { contentSearchEnabled } from 'app/config/config';
import { visibleSearchTabs } from './search.config';
import { ContentResult } from './content-result';
import './content-search.css';

export const CONTENT_SEARCH_TABLE_ID = 'search-content';

/**
 * Document content search.
 *
 * NOT built on `TableList`. The table template lays rows out as table cells, so a result card's
 * title, metadata and each snippet became a narrow vertical ribbon. A result list is a list.
 * Reused instead: the hero banner, the search/filter template, pagination and `useTable`.
 */
export function ContentSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => paramsToObject(searchParams), [searchParams]);

  const tabs = visibleSearchTabs(contentSearchEnabled());
  const currentPage = +(params['currentPage'] || 1);
  const pageSize = +(params['pageSize'] || 10);

  const table = useTable(CONTENT_SEARCH_TABLE_ID, {
    dataset: 'DocumentChunk',
    keywords: params['keywords'] || '',
    currentPage,
    pageSize,
    // Relevance always. There is no meaningful field sort over passages, and `-score` is what the
    // search API reads as "issue no $orderby", leaving BM25's ranking in place.
    sortBy: '-score',
    populate: true,
    // NO FILTER CONTROLS on this tab, and no filter keys forwarded from a stale link. A chunk
    // filter has to resolve to a document id set first, and a corpus-wide value exceeds
    // DOCUMENT_SCOPE_CAP, so the API drops the key and answers 200 with the whole corpus wearing
    // the label of a filtered result. The Documents tab keeps all five — they work there.
    filters: {},
  });

  /**
   * Passages, not documents. Used ONLY to decide whether another page exists — never shown. Azure
   * cannot count distinct documents, and "1,128,702 results" told a reader nothing.
   */
  const passageTotal = table.totalListItems;
  const results = table.data;

  function submit(next: Params): void {
    setSearchParams(toSearchParams(next), { replace: true });
  }

  function executeSearch(searchPackage: SearchPackage): void {
    // Page size is the user's choice, not part of the search.
    submit({
      pageSize: params['pageSize'],
      currentPage: 1,
      keywords: searchPackage.keywords?.trim() || null,
    });
  }

  return (
    <main className="content-search">
      <HeroBanner
        title="Search Inside Documents"
        description="Search the text inside documents from the Environmental Assessment Office, not just their titles. Results show the matching passages and the text around them."
        actions={[
          {
            label: 'List of Projects',
            icon: 'list',
            routerLink: '/projects-list',
            title: 'List of Projects',
          },
        ]}
      />

      {tabs.length > 0 && (
        <div className="container">
          <ul className="nav nav-tabs search-tabs" role="tablist">
            {tabs.map((tab) => (
              <li className="nav-item" role="presentation" key={tab.link}>
                <NavLink
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  role="tab"
                  to={tab.link}
                  end
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="results-container">
        <div className="container">
          <section className="mb-4 pt-0 pb-0">
            <SearchFilterTemplate
              onSearch={executeSearch}
              advancedFilters={false}
              searchHelpLink="/search-help"
              searching={table.loading}
            />
          </section>

          {table.loading ? (
            <p className="results-status" role="status">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="results-status" role="status">
              No documents contain that text. Try fewer or more general words.
            </p>
          ) : (
            <>
              {/* Documents on this page, deliberately without a total. The only count the index can
                  give is matching passages, which is not a number a reader can use. */}
              <p className="results-status" role="status">
                Showing {results.length} document{results.length === 1 ? '' : 's'}
                {currentPage > 1 && <span> · page {currentPage}</span>}
              </p>

              <ol className="results-list">
                {results.map((doc: any) => (
                  <li key={doc._id}>
                    <ContentResult result={doc} />
                  </li>
                ))}
              </ol>

              <Pagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={passageTotal}
                ariaLabel="Content search pagination"
                onPageChange={(page) => submit({ ...params, currentPage: page })}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
