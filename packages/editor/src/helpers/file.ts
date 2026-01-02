export enum EFileError {
  INVALID_TYPE = "INVALID_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
}

type IsFileValidArgs = {
  acceptedMimeTypes: string[];
  file: File;
  maxFileSize: number;
  onError: (error: EFileError, message: string) => void;
};

export const isFileValid = (args: IsFileValidArgs): boolean => {
  const { acceptedMimeTypes, file, maxFileSize, onError } = args;

  // Check file type
  if (acceptedMimeTypes.length > 0 && !acceptedMimeTypes.includes(file.type)) {
    onError(
      EFileError.INVALID_TYPE,
      `Invalid file type. Accepted types: ${acceptedMimeTypes.join(", ")}`
    );
    return false;
  }

  // Check file size
  if (file.size > maxFileSize) {
    const maxSizeMB = (maxFileSize / (1024 * 1024)).toFixed(2);
    onError(
      EFileError.FILE_TOO_LARGE,
      `File is too large. Maximum size is ${maxSizeMB}MB`
    );
    return false;
  }

  return true;
};
