import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface ChapterCheckpoint {
  completedImages: number[];
}

interface CheckpointFile {
  version: 1;
  chapters: Record<string, ChapterCheckpoint>;
}

const EMPTY_STATE: CheckpointFile = {
  version: 1,
  chapters: {}
};

export class CheckpointStore {
  private state: CheckpointFile;

  constructor(private readonly filePath: string) {
    this.state = this.load();
  }

  isImageDone(chapterKey: string, imageIndex: number): boolean {
    const chapter = this.state.chapters[chapterKey];
    if (!chapter) {
      return false;
    }
    return chapter.completedImages.includes(imageIndex);
  }

  markImageDone(chapterKey: string, imageIndex: number): void {
    if (!this.state.chapters[chapterKey]) {
      this.state.chapters[chapterKey] = { completedImages: [] };
    }

    const images = this.state.chapters[chapterKey].completedImages;
    if (!images.includes(imageIndex)) {
      images.push(imageIndex);
      images.sort((a, b) => a - b);
    }
  }

  save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  private load(): CheckpointFile {
    try {
      const raw = readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CheckpointFile>;
      if (parsed.version !== 1 || !parsed.chapters) {
        return EMPTY_STATE;
      }
      return {
        version: 1,
        chapters: parsed.chapters
      };
    } catch {
      return EMPTY_STATE;
    }
  }
}

export function createCheckpointStore(filePath: string): CheckpointStore {
  return new CheckpointStore(filePath);
}
