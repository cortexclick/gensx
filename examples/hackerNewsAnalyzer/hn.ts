interface HNItem {
  id: number;
  type: "story" | "comment";
  by: string;
  time: number;
  text?: string;
  kids?: number[];
  score?: number;
  title?: string;
  url?: string;
  deleted?: boolean;
  dead?: boolean;
}

class HNError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "HNError";
  }
}

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";

async function fetchJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data as T;
  } catch (error) {
    throw new HNError(`Failed to fetch ${url}`, error);
  }
}

export async function getTopStories(limit = 500): Promise<number[]> {
  const stories = await fetchJson<number[]>(`${HN_API_BASE}/topstories.json`);
  return stories.slice(0, limit);
}

export async function getItem(id: number): Promise<HNItem> {
  return fetchJson<HNItem>(`${HN_API_BASE}/item/${id}.json`);
}

export async function getComments(
  parentId: number,
  limit = 10,
): Promise<HNItem[]> {
  const parent = await getItem(parentId);
  if (!parent.kids || parent.kids.length === 0) {
    return [];
  }

  const commentPromises = parent.kids.slice(0, limit).map((id) => getItem(id));

  const comments = await Promise.all(commentPromises);
  return comments.filter(
    (comment) => comment.type === "comment" && comment.text && !comment.deleted,
  );
}

export interface HNStory {
  id: number;
  title: string;
  text: string;
  comments: {
    text: string;
    score: number;
  }[];
  url?: string;
  score: number;
  by: string;
  time: number;
}

export async function getFullStory(id: number): Promise<HNStory | null> {
  try {
    const story = await getItem(id);

    // Skip non-text stories, link-only stories, or deleted/dead stories
    if (
      story.type !== "story" ||
      !(story.text ?? story.deleted ?? story.dead)
    ) {
      return null;
    }

    const comments = await getComments(id);

    return {
      id: story.id,
      title: story.title ?? "",
      text: story.text ?? "", // No longer need URL fallback
      comments: comments.map((comment) => ({
        text: comment.text ?? "",
        score: comment.score ?? 0,
      })),
      url: story.url, // Keep URL as optional metadata
      score: story.score ?? 0,
      by: story.by,
      time: story.time,
    };
  } catch (error) {
    console.error(`Failed to get full story ${id}:`, error);
    return null;
  }
}

export async function getTopStoryDetails(
  limit = 500,
  batchSize = 50,
): Promise<HNStory[]> {
  const storyIds = await getTopStories(limit);
  const stories: HNStory[] = [];

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < storyIds.length; i += batchSize) {
    const batch = storyIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((id) => getFullStory(id)));

    stories.push(...batchResults.filter((s): s is HNStory => s !== null));

    // Small delay between batches
    if (i + batchSize < storyIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return stories;
}
