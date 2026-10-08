"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { getSearchText } from "@/lib/actions/search";
import { countMatches, indexStory, searchStory, type SearchIndex } from "@/lib/search";

type Status = "idle" | "loading" | "ready" | "failed";

type StorySearch = {
  status: Status;
  /** Fetches the Story's text, unless what's held is recent enough. */
  load: () => void;
  search: (query: string) => ReturnType<typeof searchStory>;
  counts: (query: string) => ReturnType<typeof countMatches>;
};

const SearchContext = createContext<StorySearch | null>(null);

const FRESH_MS = 30_000;

/** The Story's text for searching in the browser, fetched on first use and reused across Desk pages for a while. */
export function StorySearchProvider({ storyId, children }: { storyId: string; children: React.ReactNode }) {
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const loadedAt = useRef(0);
  const loading = useRef(false);

  const load = useCallback(() => {
    if (loading.current || Date.now() - loadedAt.current < FRESH_MS) return;
    loading.current = true;
    setStatus("loading");
    getSearchText(storyId)
      .catch(() => null)
      .then((text) => {
        loading.current = false;
        if (!text) {
          setStatus("failed");
          return;
        }
        loadedAt.current = Date.now();
        setIndex(indexStory(text));
        setStatus("ready");
      });
  }, [storyId]);

  const search = useCallback((query: string) => (index ? searchStory(index, query) : null), [index]);
  const counts = useCallback((query: string) => (index ? countMatches(index, query) : []), [index]);

  return <SearchContext value={{ status, load, search, counts }}>{children}</SearchContext>;
}

export function useStorySearch() {
  const search = useContext(SearchContext);
  if (!search) throw new Error("useStorySearch needs a StorySearchProvider");
  return search;
}
