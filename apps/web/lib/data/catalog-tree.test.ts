import { describe, it, expect } from "vitest";
import {
  findNodeInTree,
  findNodeBySlug,
  getCategoryPath,
  getAllCategorySlugs,
  buildFlatCategoryOptions,
  getDescendantIds,
  type CategoryTreeNode,
} from "./catalog";

function makeNode(overrides: Partial<CategoryTreeNode> & { id: string; slug: string; name: string }): CategoryTreeNode {
  return {
    parentId: null,
    seoTitle: null,
    seoDescription: null,
    productCount: 0,
    childCount: 0,
    children: [],
    ...overrides,
  };
}

const sampleTree: CategoryTreeNode[] = [
  makeNode({
    id: "1",
    slug: "apple",
    name: "Apple",
    childCount: 2,
    children: [
      makeNode({
        id: "1a",
        slug: "iphone",
        name: "iPhone",
        parentId: "1",
        childCount: 2,
        children: [
          makeNode({ id: "1a1", slug: "iphone-17", name: "iPhone 17", parentId: "1a", productCount: 3 }),
          makeNode({ id: "1a2", slug: "iphone-16", name: "iPhone 16", parentId: "1a", productCount: 5 }),
        ],
      }),
      makeNode({ id: "1b", slug: "macbook", name: "MacBook", parentId: "1", productCount: 2 }),
    ],
  }),
  makeNode({ id: "2", slug: "samsung", name: "Samsung", productCount: 4 }),
];

describe("findNodeInTree", () => {
  it("finds root node", () => {
    expect(findNodeInTree(sampleTree, "1")?.slug).toBe("apple");
  });

  it("finds deeply nested node", () => {
    expect(findNodeInTree(sampleTree, "1a1")?.slug).toBe("iphone-17");
  });

  it("returns null for missing id", () => {
    expect(findNodeInTree(sampleTree, "999")).toBeNull();
  });
});

describe("findNodeBySlug", () => {
  it("finds node by slug", () => {
    expect(findNodeBySlug(sampleTree, "macbook")?.id).toBe("1b");
  });

  it("returns null for missing slug", () => {
    expect(findNodeBySlug(sampleTree, "pixel")).toBeNull();
  });
});

describe("getCategoryPath", () => {
  it("returns full path from root to target", () => {
    const path = getCategoryPath(sampleTree, "iphone-17");
    expect(path.map((n) => n.slug)).toEqual(["apple", "iphone", "iphone-17"]);
  });

  it("returns single-element path for root", () => {
    const path = getCategoryPath(sampleTree, "samsung");
    expect(path.map((n) => n.slug)).toEqual(["samsung"]);
  });

  it("returns empty for missing slug", () => {
    expect(getCategoryPath(sampleTree, "nonexistent")).toEqual([]);
  });
});

describe("getAllCategorySlugs", () => {
  it("collects all slugs recursively", () => {
    const slugs = getAllCategorySlugs(sampleTree);
    expect(slugs).toContain("apple");
    expect(slugs).toContain("iphone");
    expect(slugs).toContain("iphone-17");
    expect(slugs).toContain("iphone-16");
    expect(slugs).toContain("macbook");
    expect(slugs).toContain("samsung");
    expect(slugs).toHaveLength(6);
  });
});

describe("buildFlatCategoryOptions", () => {
  it("builds flat options with tree paths", () => {
    const opts = buildFlatCategoryOptions(sampleTree);
    expect(opts[0]).toEqual({ id: "1", label: "Apple", isLeaf: false });
    const iphoneOpt = opts.find((o) => o.id === "1a");
    expect(iphoneOpt?.label).toBe("Apple / iPhone");
    expect(iphoneOpt?.isLeaf).toBe(false);
    const iphone17Opt = opts.find((o) => o.id === "1a1");
    expect(iphone17Opt?.label).toBe("Apple / iPhone / iPhone 17");
    expect(iphone17Opt?.isLeaf).toBe(true);
  });

  it("excludes specified ids and their subtrees", () => {
    const opts = buildFlatCategoryOptions(sampleTree, new Set(["1a"]));
    expect(opts.find((o) => o.id === "1a")).toBeUndefined();
    expect(opts.find((o) => o.id === "1a1")).toBeUndefined();
  });
});

describe("getDescendantIds", () => {
  it("returns all descendants excluding self", () => {
    const ids = getDescendantIds(sampleTree, "1");
    expect(ids.has("1a")).toBe(true);
    expect(ids.has("1b")).toBe(true);
    expect(ids.has("1a1")).toBe(true);
    expect(ids.has("1a2")).toBe(true);
    expect(ids.has("1")).toBe(false);
  });

  it("returns empty for leaf", () => {
    const ids = getDescendantIds(sampleTree, "2");
    expect(ids.size).toBe(0);
  });

  it("returns empty for missing id", () => {
    const ids = getDescendantIds(sampleTree, "999");
    expect(ids.size).toBe(0);
  });
});
