import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Eye,
  ImagePlus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
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
  const [commentDraft, setCommentDraft] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ImageItem | null>(null);

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

  async function addTag(event: FormEvent) {
    event.preventDefault();
    if (!selectedImage || !tagInput.trim()) return;
    syncSummary(await designVault.addTag(selectedImage.id, tagInput));
    setTagInput("");
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
          <p className="small-copy">Your images. Your ideas. Your vault.</p>
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
          {notice && (
            <button className={`notice ${notice.kind}`} type="button" onClick={() => setNotice(null)}>
              {notice.text}
              <X size={14} />
            </button>
          )}
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
            {filteredImages.map((image) => (
              <button
                className={image.id === selectedId ? "image-card active" : "image-card"}
                key={image.id}
                type="button"
                onClick={() => setSelectedId(image.id)}
                onDoubleClick={() => setPreview(image)}
              >
                <span className="thumb">
                  <img src={image.imageUrl} alt={image.originalName} />
                </span>
                <span className="image-meta">
                  <strong>{image.originalName}</strong>
                  <span>{image.width && image.height ? `${image.width} x ${image.height}` : "Dimensions unknown"}</span>
                </span>
              </button>
            ))}
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
                <button className="icon-button" type="submit" title="Add tag">
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
          <img src={preview.imageUrl} alt={preview.originalName} />
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
