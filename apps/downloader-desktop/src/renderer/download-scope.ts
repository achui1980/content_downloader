export type DownloadRequestMode = "all" | "selected";

export interface DownloadScopeResult {
  selectedChapterUrls: string[];
  fallbackToAll: boolean;
}

export function resolveDownloadScope(
  mode: DownloadRequestMode,
  selectedChapterUrls: string[]
): DownloadScopeResult {
  if (mode === "all") {
    return {
      selectedChapterUrls: [],
      fallbackToAll: false
    };
  }

  if (selectedChapterUrls.length === 0) {
    return {
      selectedChapterUrls: [],
      fallbackToAll: true
    };
  }

  return {
    selectedChapterUrls,
    fallbackToAll: false
  };
}
