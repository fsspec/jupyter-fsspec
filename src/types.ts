/**
 * TypeScript interfaces and types for Jupyter FSSpec extension
 * This file defines proper types to replace 'any' usage throughout the codebase
 */

import { Signal } from '@lumino/signaling';

// =============================================================================
// Core Filesystem Types
// =============================================================================

export interface IFilesystemConfig {
  name: string;
  path: string;
  protocol: 's3' | 'local' | 'gcs' | 'azure' | string;
  access_key_env?: string;
  secret_key_env?: string;
  prefix_path?: string;
  error?: IFilesystemError;
  key?: string;
}

export interface IFilesystemError {
  short_traceback: string;
  message?: string;
  type?: string;
}

export interface IFilesysInfo {
  path: string;
  protocol: string;
  name?: string;
  prefix_path?: string;
}

export interface IUserFilesystems {
  [key: string]: IFilesystemConfig;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface IApiResponse<T = unknown> {
  status: 'success' | 'error' | 'failure';
  message?: string;
  content?: T;
  filesystems?: IUserFilesystems;
}

export interface IGetFilesResponse {
  content: IPathInfo[];
  path: string;
  status: string;
}

export interface IPathInfo {
  name: string;
  path: string;
  protocol?: string;
  size?: number;
  type?: 'file' | 'directory';
  metadata?: IPathMetadata;
  children?: { [key: string]: IPathInfo };
  id?: number | string; // Added at runtime for tree management
}

// For cases where PathInfo is used as FilesystemConfig
export interface IFilesystemInfo extends IPathInfo {
  protocol: string; // Required for filesystem info
}

export interface IPathMetadata {
  type?: 'file' | 'directory';
  size?: number;
  mtime?: string;
  [key: string]: unknown;
}

// =============================================================================
// Tree Structure Types
// =============================================================================

export interface ITreeNode {
  name?: string;
  path: string;
  children: { [key: string]: ITreeNode };
  isDirectory?: boolean;
  size?: number;
  metadata?: IPathMetadata;
  fetch?: boolean;
  id?: string | number | null;
}

export interface IBuildTargets {
  [path: string]: [TreeViewElement, { [key: string]: ITreeNode }];
}

// =============================================================================
// Upload Types
// =============================================================================

export interface IUploadInfo {
  file?: File;
  filename?: string;
  content?: string | ArrayBuffer;
  targetPath?: string;
  filesystem?: string;
  source?: 'picker' | 'browser' | 'jupyter';
  fileData?: File | Buffer | null;
  user_path?: string;
  is_dir?: boolean;
  is_browser_file_picker?: boolean;
  is_jup_browser_file?: boolean;
}

export interface IJupyterFileData {
  content: string;
  format: string;
  type: string;
}

export interface IUploadOptions {
  targetPath: string;
  filesystem: string;
  content: string | ArrayBuffer;
  filename: string;
}

// =============================================================================
// Event Types
// =============================================================================

export interface IMouseEventHandler {
  (event: MouseEvent): void;
}

export interface IInputEventHandler {
  (event: InputEvent): void;
}

export interface ICustomEventHandler {
  (event: Event): void;
}

// =============================================================================
// Signal Types
// =============================================================================

export interface ITreeItemSignals {
  treeItemClicked: Signal<unknown, string>;
  getBytesRequested: Signal<unknown, string>;
  uploadRequested: Signal<unknown, IUploadInfo>;
}

export interface IFilesysItemSignals {
  filesysClicked: Signal<unknown, string>;
}

// =============================================================================
// Component Constructor Types
// =============================================================================

// Model dependencies will be defined in future model refactoring PR

// Component options will be defined in future PRs as we improve individual components

// =============================================================================
// Model Interface
// =============================================================================

export interface IFsspecModel {
  activeFilesystem: string;
  userFilesystems: IUserFilesystems;
  retry: number;

  // Upload queue properties that exist at runtime
  queuedPickerUploadInfo?: IUploadInfo | null;
  queuedJupyterFileBrowserUploadInfo?: IUploadInfo | null;

  initialize(automatic?: boolean, retry?: number): Promise<void>;
  storeApplicationState(): void;
  setActiveFilesystem(name: string): void;
  getActiveFilesystem(): string;
  getActiveFilesystemInfo(): IFilesysInfo;
  refreshConfig(): Promise<void>;
  getStoredFilesystems(): Promise<IApiResponse<IUserFilesystems>>;
  ls(
    key: string,
    item_path: string,
    type?: string
  ): Promise<IApiResponse<IPathInfo[]> | null>;
  cat(
    key: string,
    item_path: string,
    type?: string,
    start?: number,
    end?: number
  ): Promise<IApiResponse<string> | null>;
  post(
    key: string,
    item_path: string,
    content: string | ArrayBuffer
  ): Promise<IApiResponse>;
  walkDirectory(
    key: string,
    type?: string,
    item_path?: string
  ): Promise<IApiResponse<IPathInfo[]> | null>;
  getFiles(
    key: string,
    item_path?: string,
    type?: string,
    refresh?: boolean
  ): Promise<IApiResponse<IPathInfo[]> | null>;
  listDirectory(
    key: string,
    item_path?: string,
    type?: string,
    refresh?: boolean
  ): Promise<IApiResponse<IPathInfo[]> | null>;
  upload?(
    key: string,
    local_path: string,
    remote_path: string,
    action: string
  ): Promise<unknown>;
}

// =============================================================================
// Heap Storage Types
// =============================================================================

export interface IElementHeap {
  [path: string]: ITreeItemElement;
}

export interface ISourcesHeap {
  [name: string]: IFilesysItemElement;
}

// =============================================================================
// Utility Types
// =============================================================================

export interface ILoggerContext {
  [key: string]: unknown;
}

export interface IDeleteQueueItem {
  element: HTMLElement;
  identifier: string;
}

// =============================================================================
// Web Component Types
// =============================================================================

// Tree view component type - can be HTMLElement or custom element
export type TreeViewElement = HTMLElement;

// Helper for result types
export interface IResult<T> {
  value: T;
}

// JupyterLab file browser types
export interface IFileBrowserModel {
  value: {
    path: string;
    name: string;
    type: string;
    size: number;
    mimetype: string;
  };
}

// Element heap types
export interface ITreeItemElement {
  setMetadata(
    path: string,
    size?: number | string,
    childrenCount?: number
  ): void;
  expandItem(): void;
}

export interface IFilesysItemElement {
  selected: boolean;
  setMetadata(path: string): void;
}

// =============================================================================
// Global Window Extensions
// =============================================================================

// Note: Window.fsspecModel type declaration is in fileOperations.ts to avoid conflicts
