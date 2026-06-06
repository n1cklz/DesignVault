import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app } from "electron";
import sizeOf from "image-size";
import type { ImageItem, ImportResult, Tag, VaultSummary } from "../shared/types";

const allowedMimeTypes = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);

interface ImageRow {
  id: number;
  filename: string;
  original_name: string;
  stored_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

interface TagRow {
  id: number;
  name: string;
}

interface CommentRow {
  id: number;
  image_id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export class VaultDatabase {
  private db: Database.Database;
  private vaultDir: string;

  constructor() {
    const dataDir = path.join(app.getPath("userData"), "DesignVault");
    this.vaultDir = path.join(dataDir, "images");
    fs.mkdirSync(this.vaultDir, { recursive: true });
    this.db = new Database(path.join(dataDir, "designvault.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  listImages(): VaultSummary {
    const images = this.db
      .prepare(
        `select id, filename, original_name, stored_path, mime_type, width, height, created_at, updated_at
         from images
         order by datetime(created_at) desc, id desc`,
      )
      .all() as ImageRow[];
    const tags = this.db.prepare("select id, name from tags order by lower(name)").all() as TagRow[];
    const imageTags = this.db
      .prepare(
        `select image_tags.image_id, tags.id, tags.name
         from image_tags
         join tags on tags.id = image_tags.tag_id
         order by lower(tags.name)`,
      )
      .all() as Array<{ image_id: number; id: number; name: string }>;
    const comments = this.db
      .prepare("select id, image_id, body, created_at, updated_at from comments")
      .all() as CommentRow[];

    const tagsByImage = new Map<number, Tag[]>();
    for (const tag of imageTags) {
      const list = tagsByImage.get(tag.image_id) ?? [];
      list.push({ id: tag.id, name: tag.name });
      tagsByImage.set(tag.image_id, list);
    }

    const commentsByImage = new Map(comments.map((comment) => [comment.image_id, comment]));

    return {
      images: images.map((image) => ({
        id: image.id,
        filename: image.filename,
        originalName: image.original_name,
        storedPath: image.stored_path,
        imageUrl: pathToFileURL(image.stored_path).href,
        mimeType: image.mime_type,
        width: image.width,
        height: image.height,
        createdAt: image.created_at,
        updatedAt: image.updated_at,
        tags: tagsByImage.get(image.id) ?? [],
        comment: this.mapComment(commentsByImage.get(image.id) ?? null),
      })),
      tags: tags.map((tag) => ({ id: tag.id, name: tag.name })),
    };
  }

  importImages(sourcePaths: string[]): ImportResult {
    const imported: ImageItem[] = [];
    const errors: string[] = [];

    for (const sourcePath of sourcePaths) {
      try {
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          errors.push(`Missing file: ${sourcePath}`);
          continue;
        }

        const ext = path.extname(sourcePath).toLowerCase();
        const mimeType = allowedMimeTypes.get(ext);
        if (!mimeType) {
          errors.push(`Unsupported file type: ${path.basename(sourcePath)}`);
          continue;
        }

        const originalName = path.basename(sourcePath);
        const filename = this.uniqueFilename(originalName);
        const storedPath = path.join(this.vaultDir, filename);
        fs.copyFileSync(sourcePath, storedPath);

        let width: number | null = null;
        let height: number | null = null;
        try {
          const dimensions = sizeOf(fs.readFileSync(storedPath));
          width = dimensions.width ?? null;
          height = dimensions.height ?? null;
        } catch {
          width = null;
          height = null;
        }

        const now = new Date().toISOString();
        const result = this.db
          .prepare(
            `insert into images
             (filename, original_name, stored_path, mime_type, width, height, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(filename, originalName, storedPath, mimeType, width, height, now, now);

        const image = this.listImages().images.find((item) => item.id === Number(result.lastInsertRowid));
        if (image) {
          imported.push(image);
        }
      } catch (error) {
        errors.push(`Failed to import ${path.basename(sourcePath)}: ${this.messageFrom(error)}`);
      }
    }

    return { imported, errors };
  }

  addTag(imageId: number, rawName: string): VaultSummary {
    const name = rawName.trim().replace(/\s+/g, " ");
    if (!name) return this.listImages();

    const now = new Date().toISOString();
    const tagResult = this.db
      .prepare("insert into tags (name, created_at) values (?, ?) on conflict(name) do update set name = excluded.name")
      .run(name, now);

    const tag =
      tagResult.lastInsertRowid && Number(tagResult.lastInsertRowid) > 0
        ? Number(tagResult.lastInsertRowid)
        : (this.db.prepare("select id from tags where name = ?").get(name) as { id: number }).id;

    this.db.prepare("insert or ignore into image_tags (image_id, tag_id) values (?, ?)").run(imageId, tag);
    this.touchImage(imageId);
    return this.listImages();
  }

  removeTag(imageId: number, tagId: number): VaultSummary {
    this.db.prepare("delete from image_tags where image_id = ? and tag_id = ?").run(imageId, tagId);
    this.touchImage(imageId);
    return this.listImages();
  }

  saveComment(imageId: number, body: string): VaultSummary {
    const trimmed = body.trim();
    const now = new Date().toISOString();

    if (!trimmed) {
      this.db.prepare("delete from comments where image_id = ?").run(imageId);
    } else {
      this.db
        .prepare(
          `insert into comments (image_id, body, created_at, updated_at)
           values (?, ?, ?, ?)
           on conflict(image_id) do update set body = excluded.body, updated_at = excluded.updated_at`,
        )
        .run(imageId, trimmed, now, now);
    }

    this.touchImage(imageId);
    return this.listImages();
  }

  removeImage(imageId: number): VaultSummary {
    const image = this.db.prepare("select stored_path from images where id = ?").get(imageId) as
      | { stored_path: string }
      | undefined;
    this.db.prepare("delete from images where id = ?").run(imageId);

    if (image?.stored_path && fs.existsSync(image.stored_path)) {
      fs.unlinkSync(image.stored_path);
    }

    return this.listImages();
  }

  private migrate() {
    this.db.exec(`
      create table if not exists images (
        id integer primary key autoincrement,
        filename text not null,
        original_name text not null,
        stored_path text not null unique,
        mime_type text not null,
        width integer,
        height integer,
        created_at text not null,
        updated_at text not null
      );

      create table if not exists tags (
        id integer primary key autoincrement,
        name text not null unique,
        created_at text not null
      );

      create table if not exists image_tags (
        image_id integer not null,
        tag_id integer not null,
        primary key (image_id, tag_id),
        foreign key (image_id) references images(id) on delete cascade,
        foreign key (tag_id) references tags(id) on delete cascade
      );

      create table if not exists comments (
        id integer primary key autoincrement,
        image_id integer not null unique,
        body text not null,
        created_at text not null,
        updated_at text not null,
        foreign key (image_id) references images(id) on delete cascade
      );
    `);
  }

  private uniqueFilename(originalName: string) {
    const ext = path.extname(originalName).toLowerCase();
    const base = path.basename(originalName, ext).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "image";
    let filename = `${base}${ext}`;
    let index = 1;

    while (fs.existsSync(path.join(this.vaultDir, filename))) {
      filename = `${base}-${index}${ext}`;
      index += 1;
    }

    return filename;
  }

  private touchImage(imageId: number) {
    this.db.prepare("update images set updated_at = ? where id = ?").run(new Date().toISOString(), imageId);
  }

  private mapComment(comment: CommentRow | null) {
    if (!comment) return null;
    return {
      id: comment.id,
      imageId: comment.image_id,
      body: comment.body,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    };
  }

  private messageFrom(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
