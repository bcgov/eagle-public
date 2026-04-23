/**
 * Shared scroll-arrow utility for `.tabs-container` / `.nav-tabs` layouts.
 *
 * Queries the DOM for `.tabs-container` and `.nav-tabs`, injects left/right
 * arrow buttons, and keeps their visibility in sync with the scroll position.
 *
 * Usage:
 *   private tabArrows: TabArrowsHandle | null = null;
 *   ngAfterViewInit() { this.tabArrows = initTabArrows(); }
 *   ngOnDestroy()     { this.tabArrows?.cleanup(); }
 */
export interface TabArrowsHandle {
  /** Disconnects ResizeObserver and removes arrow elements. */
  cleanup: () => void;
  /** Manually re-evaluates arrow visibility (e.g. after route navigation). */
  check: () => void;
}

export function initTabArrows(): TabArrowsHandle {
  let cleanupFn: (() => void) | null = null;
  let checkFn: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function tryInit(): void {
    const tabsContainer = document.querySelector('.tabs-container') as HTMLElement;
    const navTabs = document.querySelector('.nav-tabs') as HTMLElement;

    if (!tabsContainer || !navTabs) {
      timer = setTimeout(tryInit, 100);
      return;
    }

    // Avoid creating duplicate arrows when called multiple times
    if (tabsContainer.querySelector('.tab-arrow')) {
      return;
    }

    const leftArrow = document.createElement('button');
    leftArrow.className = 'tab-arrow tab-arrow-left';
    leftArrow.innerHTML = '&#8249;';
    leftArrow.setAttribute('aria-label', 'Scroll tabs left');
    leftArrow.type = 'button';

    const rightArrow = document.createElement('button');
    rightArrow.className = 'tab-arrow tab-arrow-right';
    rightArrow.innerHTML = '&#8250;';
    rightArrow.setAttribute('aria-label', 'Scroll tabs right');
    rightArrow.type = 'button';

    tabsContainer.appendChild(leftArrow);
    tabsContainer.appendChild(rightArrow);

    const checkArrows = () => {
      const hasOverflow = navTabs.scrollWidth > navTabs.clientWidth;
      const isAtStart = navTabs.scrollLeft <= 1;
      const isAtEnd = navTabs.scrollLeft >= navTabs.scrollWidth - navTabs.clientWidth - 1;

      leftArrow.style.display = hasOverflow && !isAtStart ? 'flex' : 'none';
      rightArrow.style.display = hasOverflow && !isAtEnd ? 'flex' : 'none';
    };

    leftArrow.addEventListener('click', () => {
      navTabs.scrollBy({ left: -200, behavior: 'smooth' });
      setTimeout(checkArrows, 100);
    });

    rightArrow.addEventListener('click', () => {
      navTabs.scrollBy({ left: 200, behavior: 'smooth' });
      setTimeout(checkArrows, 100);
    });

    navTabs.addEventListener('scroll', checkArrows);

    const resizeObserver = new ResizeObserver(() => checkArrows());
    resizeObserver.observe(navTabs);

    setTimeout(() => checkArrows(), 0);

    checkFn = checkArrows;
    cleanupFn = () => {
      resizeObserver.disconnect();
      leftArrow.remove();
      rightArrow.remove();
    };
  }

  tryInit();

  return {
    cleanup: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      cleanupFn?.();
    },
    check: () => checkFn?.(),
  };
}
