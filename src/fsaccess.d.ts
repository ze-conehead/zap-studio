// The parts of the File System Access API that TypeScript's lib.dom still
// leaves out. Chromium-only; src/autobackup.ts feature-detects before use.

interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: FileSystemHandle | string;
}

interface Window {
  showDirectoryPicker(
    options?: DirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>;
}
