declare global {
  interface Window {
    /** HotJar, loaded by an external tag; absent unless the tag is on the page. */
    hj?: (event: string, name: string) => void;
  }
}

export {};
