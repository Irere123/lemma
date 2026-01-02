export type TImageStatus = "PENDING" | "UPLOADING" | "UPLOADED" | "ERROR" | "DUPLICATING";

// Enum for custom image status
export enum ECustomImageStatus {
  PENDING = "PENDING",
  UPLOADING = "UPLOADING",
  UPLOADED = "UPLOADED",
  ERROR = "ERROR",
  DUPLICATING = "DUPLICATING",
}

// Enum for custom image attribute names
export enum ECustomImageAttributeNames {
  ID = "data-id",
  SRC = "src",
  WIDTH = "width",
  HEIGHT = "height",
  STATUS = "data-status",
  ASPECT_RATIO = "data-aspect-ratio",
}

export type InsertImageComponentProps = {
  event: "insert" | "drop";
  pos?: number;
  file?: File;
};

export type TImageNodeAttributes = {
  id: string;
  src: string;
  width: number | string;
  height: number | string;
  aspectRatio: number;
  status: TImageStatus;
};

export type TImageStorage = {
  fileMap: Map<string, File>;
  deletedImageSet: Set<string>;
  maxFileSize: number;
};
