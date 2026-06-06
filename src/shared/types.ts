export interface Tag {
  id: number;
  name: string;
}

export interface Comment {
  id: number;
  imageId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImageItem {
  id: number;
  filename: string;
  originalName: string;
  storedPath: string;
  imageUrl: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  comment: Comment | null;
}

export interface VaultSummary {
  images: ImageItem[];
  tags: Tag[];
}

export interface ImportResult {
  imported: ImageItem[];
  errors: string[];
}

export interface DesignVaultApi {
  listImages: () => Promise<VaultSummary>;
  importImages: (paths: string[]) => Promise<ImportResult>;
  chooseImages: () => Promise<ImportResult | null>;
  addTag: (imageId: number, tagName: string) => Promise<VaultSummary>;
  removeTag: (imageId: number, tagId: number) => Promise<VaultSummary>;
  saveComment: (imageId: number, body: string) => Promise<VaultSummary>;
  removeImage: (imageId: number) => Promise<VaultSummary>;
  getDroppedFilePath: (file: File) => string;
}
