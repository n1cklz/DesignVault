import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Eye,
  ImagePlus,
  Search,
  Trash2,
  Upload,
  X,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import leftArrowUrl from "./assets/arrow-left.svg";
import rightArrowUrl from "./assets/arrow-right.svg";
import type { ImageItem, Tag, VaultSummary } from "../shared/types";
import { createBrowserPreviewApi } from "./browserPreviewApi";
import "./styles.css";

type Notice = { kind: "error" | "info"; text: string } | null;
const designVault = window.designVault ?? createBrowserPreviewApi();

function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [activeTagIds, setActiveTagIds] = useState<number[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ImageItem | null>(null);
  const [multiSelectIds, setMultiSelectIds] = useState<number[]>([]);

  useEffect(() => {
    void refresh();
  }, []);

  const selectedImage = images.find((image) => image.id === selectedId) ?? images[0] ?? null;

  useEffect(() => {
    if (selectedImage) {
      setSelectedId(selectedImage.id);
      setCommentDraft(selectedImage.comment?.body ?? "");
    } else {
      setSelectedId(null);
      setCommentDraft("");
    }
  }, [selectedImage?.id, selectedImage?.comment?.body]);

  const filteredImages = useMemo(() => {
    const query = search.trim().toLowerCase();

    return images.filter((image) => {
      const matchesTags =
        activeTagIds.length === 0 || activeTagIds.every((tagId) => image.tags.some((tag) => tag.id === tagId));
      const haystack = [
        image.originalName,
        image.filename,
        image.comment?.body ?? "",
        ...image.tags.map((tag) => tag.name),
      ]
        .join(" ")
        .toLowerCase();

      return matchesTags && (!query || haystack.includes(query));
    });
  }, [activeTagIds, images, search]);

  async function refresh() {
    const summary = await designVault.listImages();
    syncSummary(summary);
  }

  function syncSummary(summary: VaultSummary) {
    setImages(summary.images);
    setTags(summary.tags);
  }

  async function chooseImages() {
    const result = await designVault.chooseImages();
    if (!result) return;
    await handleImportResult(result.imported.length, result.errors);
  }

  async function importPaths(paths: string[]) {
    if (paths.length === 0) return;
    const result = await designVault.importImages(paths);
    await handleImportResult(result.imported.length, result.errors);
  }

  async function handleImportResult(importedCount: number, errors: string[]) {
    await refresh();
    if (errors.length > 0) {
      setNotice({ kind: "error", text: errors.join(" ") });
    } else if (importedCount > 0) {
      setNotice({ kind: "info", text: `${importedCount} image${importedCount === 1 ? "" : "s"} imported.` });
    }
  }

  async function addTag(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedImage) return;

    const rawValue = tagInput.trim();
    if (!rawValue) return;

    const existingTagNames = selectedImage.tags.map((tag) => tag.name.toLowerCase());
    const tagsToAdd = rawValue
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .reduce<string[]>((acc, next) => {
        if (acc.some((existing) => existing.toLowerCase() === next.toLowerCase())) {
          return acc;
        }
        if (existingTagNames.includes(next.toLowerCase())) {
          return acc;
        }
        return [...acc, next];
      }, []);

    if (tagsToAdd.length === 0) {
      setTagInput("");
      return;
    }

    if ((selectedImage.tags?.length ?? 0) + tagsToAdd.length > 10) {
      setNotice({ kind: "error", text: "Maximum of 10 tags per image." });
      return;
    }

    const targetImageId = selectedImage.id; // capture id to avoid stale state
    if (isAddingTag) return; // avoid duplicate submits
    setIsAddingTag(true);
    try {
      let summary: VaultSummary | null = null;
      for (const nextTag of tagsToAdd) {
        // preserve each comma-separated value as a separate tag
        summary = await designVault.addTag(targetImageId, nextTag);
      }
      if (summary) {
        syncSummary(summary);
      }
      setTagInput("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setNotice({ kind: "error", text: `Failed to add tag: ${msg}` });
      // surface useful debug info to terminal
      // eslint-disable-next-line no-console
      console.error("addTag failed", { imageId: targetImageId, rawValue, err });
    } finally {
      setIsAddingTag(false);
    }
  }

  async function removeTag(tagId: number) {
    if (!selectedImage) return;
    syncSummary(await designVault.removeTag(selectedImage.id, tagId));
  }

  async function saveComment() {
    if (!selectedImage) return;
    syncSummary(await designVault.saveComment(selectedImage.id, commentDraft));
    setNotice({ kind: "info", text: "Comment saved." });
  }

  async function removeImage() {
    if (!selectedImage) return;
    const confirmed = window.confirm(`Remove "${selectedImage.originalName}" from DesignVault?`);
    if (!confirmed) return;
    syncSummary(await designVault.removeImage(selectedImage.id));
    setPreview(null);
    setNotice({ kind: "info", text: "Image removed." });
  }

  function toggleMultiSelect(imageId: number) {
    setMultiSelectIds((current) => (current.includes(imageId) ? current.filter((id) => id !== imageId) : [...current, imageId]));
  }

  async function removeSelectedImages() {
    if (multiSelectIds.length === 0) return;
    const confirmed = window.confirm(`Remove ${multiSelectIds.length} selected image(s)?`);
    if (!confirmed) return;
    for (const id of multiSelectIds) {
      // sequential removal for simplicity
      // underlying API may dedupe or cascade
      // ignore individual errors and continue
      try {
        // eslint-disable-next-line no-await-in-loop
        await designVault.removeImage(id);
      } catch (err) {
        console.error("Failed to remove image", id, err);
      }
    }
    await refresh();
    setMultiSelectIds([]);
    setPreview(null);
    setNotice({ kind: "info", text: "Selected images removed." });
  }

  async function removeImageById(imageId: number) {
    const image = images.find((i) => i.id === imageId);
    if (!image) return;
    const confirmed = window.confirm(`Remove "${image.originalName}" from DesignVault?`);
    if (!confirmed) return;
    try {
      await designVault.removeImage(imageId);
      await refresh();
      setPreview(null);
      setNotice({ kind: "info", text: "Image removed." });
      // if this image was selected, clear selection
      if (selectedId === imageId) setSelectedId(null);
    } catch (err) {
      console.error("Failed to remove image by id", imageId, err);
      setNotice({ kind: "error", text: `Failed to remove image: ${String(err)}` });
    }
  }

  function navigatePreview(direction: "previous" | "next") {
    if (!preview && selectedImage == null) return;
    const currentId = preview?.id ?? selectedImage?.id ?? null;
    if (currentId == null) return;
    const idx = filteredImages.findIndex((img) => img.id === currentId);
    if (idx === -1) return;
    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= filteredImages.length) return;
    const nextImage = filteredImages[nextIdx];
    setPreview(nextImage);
    setSelectedId(nextImage.id);
  }

  function toggleTag(tagId: number) {
    setActiveTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  return (
    <main
      className={`app-shell ${isDragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => designVault.getDroppedFilePath(file))
          .filter(Boolean);
        void importPaths(paths);
      }}
    >
      <aside className="sidebar">
        <div>
          <h1>DESIGNVAULT</h1>
        </div>

        <button className="primary-button" type="button" onClick={chooseImages}>
          <Upload size={17} />
          Import
        </button>

        <label className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files, tags, comments"
          />
        </label>

        <section className="filter-section">
          <div className="section-title">Tags</div>
          {tags.length === 0 ? (
            <p className="muted">No tags yet.</p>
          ) : (
            <div className="tag-filter-list">
              {tags.map((tag) => (
                <button
                  className={activeTagIds.includes(tag.id) ? "tag-filter active" : "tag-filter"}
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="status-block">
          <span>{images.length} stored</span>
          <span>{filteredImages.length} visible</span>
          <span>{activeTagIds.length} filters</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div>
            <div className="section-title">Archive</div>
            <p>{filteredImages.length === 1 ? "1 image" : `${filteredImages.length} images`}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {multiSelectIds.length > 0 && (
              <button className="danger-button" type="button" onClick={removeSelectedImages} style={{ width: "auto", height: 36 }}>
                <Trash2 size={14} /> Remove {multiSelectIds.length}
              </button>
            )}
            {notice && (
              <button className={`notice ${notice.kind}`} type="button" onClick={() => setNotice(null)}>
                {notice.text}
                <X size={14} />
              </button>
            )}
          </div>
        </header>

        {images.length === 0 ? (
          <EmptyState onImport={chooseImages} />
        ) : filteredImages.length === 0 ? (
          <div className="empty-state">
            <Search size={36} />
            <h2>No matching images</h2>
            <p>Clear search or tag filters to return to the full vault.</p>
          </div>
        ) : (
          <div className="image-grid">
            {filteredImages.map((image) => {
                          const isSelected = image.id === selectedId;
                          const isMultiSelected = multiSelectIds.includes(image.id);
                          // show the dot only when multi-select mode is active or the item is part of multi selection
                          const showIndicator = multiSelectIds.length > 0 || isMultiSelected;
                          const indicatorState = isMultiSelected ? "selected" : "unselected";

              return (
                <button
                  className={image.id === selectedId ? "image-card active" : "image-card"}
                  key={image.id}
                  type="button"
                  onClick={() => setSelectedId(image.id)}
                  onDoubleClick={() => setPreview(image)}
                >
                  {showIndicator && (
                    <span
                      className={`selection-indicator ${indicatorState}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMultiSelect(image.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleMultiSelect(image.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={isMultiSelected ? "Remove from selection" : "Add to selection"}
                    />
                  )}

                  <div className="card-actions">
                    <button
                      className="card-action-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleMultiSelect(image.id);
                      }}
                      title="Select"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="card-action-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (multiSelectIds.length > 0) {
                          void removeSelectedImages();
                        } else {
                          void removeImageById(image.id);
                        }
                      }}
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <span className="thumb">
                    <img src={image.imageUrl} alt={image.originalName} />
                  </span>
                  <span className="image-meta">
                    <strong>{image.originalName}</strong>
                    <span>{image.width && image.height ? `${image.width} x ${image.height}` : "Dimensions unknown"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <aside className="inspector">
        {selectedImage ? (
          <>
            <div className="inspector-preview">
              <img src={selectedImage.imageUrl} alt={selectedImage.originalName} />
            </div>
            <div className="inspector-header">
              <div>
                <div className="section-title">Selected</div>
                <h2>{selectedImage.originalName}</h2>
                <p>
                  {selectedImage.width && selectedImage.height
                    ? `${selectedImage.width} x ${selectedImage.height}`
                    : "Dimensions unknown"}
                </p>
              </div>
              <button className="icon-button" type="button" onClick={() => setPreview(selectedImage)} title="View larger">
                <Eye size={18} />
              </button>
            </div>

            <section className="inspector-section">
              <div className="section-title">Tags</div>
              <div className="selected-tags">
                {selectedImage.tags.length === 0 ? (
                  <span className="muted">No tags.</span>
                ) : (
                  selectedImage.tags.map((tag) => (
                    <button className="tag-chip" key={tag.id} type="button" onClick={() => removeTag(tag.id)}>
                      {tag.name}
                      <X size={13} />
                    </button>
                  ))
                )}
              </div>
              <form className="tag-form" onSubmit={addTag}>
                <input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  placeholder="Add tag"
                />
                <button
                  className="icon-button"
                  type="submit"
                  title="Add tag"
                  disabled={isAddingTag || !tagInput.trim() || (selectedImage.tags.length >= 10)}
                >
                  <ImagePlus size={17} />
                </button>
              </form>
            </section>

            <section className="inspector-section">
              <div className="section-title">Comments</div>
              <textarea
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Write notes about this reference"
              />
              <button className="secondary-button" type="button" onClick={saveComment}>
                Save comment
              </button>
            </section>

            <section className="inspector-section">
              <div className="section-title">Added</div>
              <p>{new Date(selectedImage.createdAt).toLocaleString()}</p>
            </section>

            <button className="danger-button" type="button" onClick={removeImage}>
              <Trash2 size={17} />
              Remove image
            </button>
          </>
        ) : (
          <div className="empty-inspector">
            <Eye size={30} />
            <p>Select an image to inspect it.</p>
          </div>
        )}
      </aside>

      {preview && (
        <div className="preview-overlay" role="dialog" aria-modal="true">
          <button className="preview-close" type="button" onClick={() => setPreview(null)} title="Close preview">
            <X size={22} />
          </button>
          <button
            className="preview-arrow preview-left"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigatePreview("previous");
            }}
            title="Previous"
          >
            <img src={leftArrowUrl} alt="Previous" />
          </button>

          <button
            className="preview-arrow preview-right"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigatePreview("next");
            }}
            title="Next"
          >
            <img src={rightArrowUrl} alt="Next" />
          </button>
          <img
            src={preview.imageUrl}
            alt={preview.originalName}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
          />
          <div className="preview-caption">{preview.originalName}</div>
        </div>
      )}
    </main>
  );
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="empty-state">
      <ImagePlus size={42} />
      <h2>Start your visual memory</h2>
      <p>Drop images anywhere in this window or import them from your machine.</p>
      <button className="primary-button compact" type="button" onClick={onImport}>
        <Upload size={17} />
        Import images
      </button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
