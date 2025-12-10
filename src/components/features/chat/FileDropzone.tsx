import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { invoke } from "@tauri-apps/api/core";

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface FileDropzoneProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  children?: React.ReactNode;
}

export function FileDropzone({ onFilesUploaded, children }: FileDropzoneProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of acceptedFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        const result = await invoke<string>("upload_file_to_workspace", {
          fileName: file.name,
          fileData: Array.from(bytes),
        });

        newFiles.push({
          name: file.name,
          path: result,
          size: file.size,
          type: file.type || "application/octet-stream",
        });
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
    onFilesUploaded(newFiles);
    setIsUploading(false);
  }, [onFilesUploaded]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
  });

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />
      
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/20 border-2 border-dashed border-primary rounded-xl backdrop-blur-sm">
          <div className="text-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto text-primary mb-2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-primary font-medium">Drop files here</p>
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {uploadedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 px-2 py-1 bg-tertiary rounded-lg text-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-basic"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-content max-w-[100px] truncate" title={file.name}>
                {file.name}
              </span>
              <span className="text-basic">{formatSize(file.size)}</span>
              <button
                onClick={() => removeFile(index)}
                className="text-basic hover:text-red-400 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {isUploading && (
        <div className="mb-2 flex items-center gap-2 text-xs text-basic">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Uploading files...</span>
        </div>
      )}

      {children}

      <button
        type="button"
        onClick={open}
        className="absolute left-3 bottom-3 p-2 text-basic hover:text-content transition-colors"
        title="Attach files"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
    </div>
  );
}
