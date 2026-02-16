import { describe, it, expect } from "vitest";
import {
  parseMentions,
  extractMentions,
  getCurrentMention,
  replaceMention,
  highlightMentions,
  parseProjects,
  extractProjects,
  cleanTaskTitle,
} from "./mentions";

describe("parseMentions", () => {
  it("returns empty for no text", () => {
    expect(parseMentions("")).toEqual({ stakeholders: [], executor: null });
  });

  it("extracts stakeholders from @mentions", () => {
    const result = parseMentions("talk to @gwenith and @suzan");
    expect(result.stakeholders).toEqual(["gwenith", "suzan"]);
    expect(result.executor).toBeNull();
  });

  it("extracts executor from arrow pattern", () => {
    const result = parseMentions("fix bug → @jeff");
    expect(result.executor).toBe("jeff");
    expect(result.stakeholders).toEqual([]);
  });

  it("extracts executor from > pattern", () => {
    const result = parseMentions("fix bug > @jeff");
    expect(result.executor).toBe("jeff");
  });

  it("extracts executor from delegate pattern", () => {
    const result = parseMentions("delegate to @bob");
    expect(result.executor).toBe("bob");
  });

  it("extracts executor from assigned to pattern", () => {
    const result = parseMentions("assigned to @alice");
    expect(result.executor).toBe("alice");
  });

  it("separates executor from stakeholders", () => {
    const result = parseMentions("@gwenith review → @jeff");
    expect(result.executor).toBe("jeff");
    expect(result.stakeholders).toEqual(["gwenith"]);
  });

  it("deduplicates stakeholders", () => {
    const result = parseMentions("@alice and @alice again");
    expect(result.stakeholders).toEqual(["alice"]);
  });

  it("lowercases handles", () => {
    const result = parseMentions("@Alice");
    expect(result.stakeholders).toEqual(["alice"]);
  });
});

describe("extractMentions", () => {
  it("returns empty for no text", () => {
    expect(extractMentions("")).toEqual([]);
  });

  it("extracts unique mentions", () => {
    expect(extractMentions("@alice @bob @alice")).toEqual(["alice", "bob"]);
  });
});

describe("getCurrentMention", () => {
  it("returns null for empty text", () => {
    expect(getCurrentMention("", 0)).toBeNull();
  });

  it("returns partial handle after @", () => {
    expect(getCurrentMention("hello @bre", 10)).toBe("bre");
  });

  it("returns empty string right after @", () => {
    expect(getCurrentMention("hello @", 7)).toBe("");
  });

  it("returns null when not in a mention", () => {
    expect(getCurrentMention("hello world", 5)).toBeNull();
  });
});

describe("replaceMention", () => {
  it("replaces partial mention with complete handle", () => {
    const result = replaceMention("hello @bre", 10, "brett");
    expect(result.newText).toBe("hello @brett");
    expect(result.newCursorPosition).toBe(12);
  });

  it("returns original text when no @ found", () => {
    const result = replaceMention("hello world", 5, "brett");
    expect(result.newText).toBe("hello world");
  });
});

describe("highlightMentions", () => {
  it("wraps mentions in span tags", () => {
    const result = highlightMentions("hello @alice");
    expect(result).toContain("@alice");
    expect(result).toContain('class="text-blue-600');
  });
});

describe("parseProjects", () => {
  it("returns empty for no text", () => {
    expect(parseProjects("")).toEqual({ projects: [] });
  });

  it("extracts unquoted project tags", () => {
    const result = parseProjects("fix #Frontend and #Backend");
    expect(result.projects).toEqual(["Frontend", "Backend"]);
  });

  it("extracts quoted project tags with spaces", () => {
    const result = parseProjects('work on #"Project Alpha"');
    expect(result.projects).toEqual(["Project Alpha"]);
  });

  it("deduplicates case-insensitively", () => {
    const result = parseProjects("#frontend #Frontend");
    expect(result.projects).toEqual(["frontend"]);
  });
});

describe("extractProjects", () => {
  it("returns empty for no text", () => {
    expect(extractProjects("")).toEqual([]);
  });

  it("returns unique project names", () => {
    expect(extractProjects("#Frontend #Backend")).toEqual(["Frontend", "Backend"]);
  });
});

describe("cleanTaskTitle", () => {
  it("returns empty for no text", () => {
    expect(cleanTaskTitle("")).toBe("");
  });

  it("transforms @mentions to capitalized names", () => {
    expect(cleanTaskTitle("talk to @steen")).toBe("talk to Steen");
  });

  it("transforms #project to capitalized name", () => {
    expect(cleanTaskTitle("fix #frontend")).toBe("fix Frontend");
  });

  it("removes executor patterns", () => {
    expect(cleanTaskTitle("fix bug → @jeff")).toBe("fix bug");
  });

  it("removes date phrases when provided", () => {
    expect(cleanTaskTitle("do thing tomorrow", "tomorrow")).toBe("do thing");
  });

  it("handles complex input", () => {
    const result = cleanTaskTitle("Follow up with @steen tomorrow #Website", "tomorrow");
    expect(result).toBe("Follow up with Steen Website");
  });

  it("removes delegate patterns", () => {
    expect(cleanTaskTitle("delegate to @bob this task")).toBe("this task");
  });
});
