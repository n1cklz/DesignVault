import type { DesignVaultApi, ImageItem, VaultSummary } from "../shared/types";

const now = new Date().toISOString();

function svgDataUrl(label: string, fill: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="${fill}"/><path d="M120 190h560v420H120z" fill="none" stroke="#111" stroke-width="18"/><path d="M180 550l130-150 92 102 95-118 123 166" fill="none" stroke="#111" stroke-width="18"/><text x="120" y="105" font-family="Helvetica,Arial,sans-serif" font-size="54" font-weight="700" fill="#111">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const previewImages: ImageItem[] = [
  {
    id: 1,
    filename: "poster-reference.png",
    originalName: "poster-reference.png",
    storedPath: "",
    imageUrl: svgDataUrl("POSTER", "#f4f4f4"),
    mimeType: "image/png",
    width: 800,
    height: 800,
    createdAt: now,
    updatedAt: now,
    tags: [{ id: 1, name: "layout" }],
    comment: {
      id: 1,
      imageId: 1,
      body: "Strong grid, useful spacing reference.",
      createdAt: now,
      updatedAt: now,
    },
  },
  {
    id: 2,
    filename: "type-study.webp",
    originalName: "type-study.webp",
    storedPath: "",
    imageUrl: svgDataUrl("TYPE", "#ffffff"),
    mimeType: "image/webp",
    width: 800,
    height: 800,
    createdAt: now,
    updatedAt: now,
    tags: [{ id: 2, name: "typography" }],
    comment: null,
  },
];

let summary: VaultSummary = {
  images: previewImages,
  tags: [
    { id: 1, name: "layout" },
    { id: 2, name: "typography" },
  ],
};

export function createBrowserPreviewApi(): DesignVaultApi {
  return {
    listImages: async () => summary,
    importImages: async () => ({ imported: [], errors: ["Import is available in the Electron desktop app."] }),
    chooseImages: async () => ({ imported: [], errors: ["Import is available in the Electron desktop app."] }),
    addTag: async (imageId, tagName) => {
      const name = tagName.trim();
      if (!name) return summary;
      const existing = summary.tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
      const tag = existing ?? { id: Date.now(), name };
      summary = {
        tags: existing ? summary.tags : [...summary.tags, tag],
        images: summary.images.map((image) =>
          image.id === imageId && !image.tags.some((item) => item.id === tag.id)
            ? { ...image, tags: [...image.tags, tag] }
            : image,
        ),
      };
      return summary;
    },
    removeTag: async (imageId, tagId) => {
      summary = {
        ...summary,
        images: summary.images.map((image) =>
          image.id === imageId ? { ...image, tags: image.tags.filter((tag) => tag.id !== tagId) } : image,
        ),
      };
      return summary;
    },
    saveComment: async (imageId, body) => {
      summary = {
        ...summary,
        images: summary.images.map((image) =>
          image.id === imageId
            ? {
                ...image,
                comment: body.trim()
                  ? { id: image.comment?.id ?? Date.now(), imageId, body, createdAt: now, updatedAt: new Date().toISOString() }
                  : null,
              }
            : image,
        ),
      };
      return summary;
    },
    removeImage: async (imageId) => {
      summary = { ...summary, images: summary.images.filter((image) => image.id !== imageId) };
      return summary;
    },
    getDroppedFilePath: () => "",
  };
}
