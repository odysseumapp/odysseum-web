/**
 * The contract between the web UI and a plugin's client modules. Third-party plugins build against these types; change
 * them only in a way that keeps old plugins working, and raise `apiVersion` when that is not possible.
 *
 * The plugin's C# code has one `IViewDefinition` class per view, with a label, an icon and a client entry; `GET /api/plugins`
 * gives them to the host. The client entry is an ES module whose default export is the view's component, with
 * `ViewProps` as props and `ViewEmits` as events; it registers nothing. The host imports it when the view is first
 * selected. Before the import, the host sets the API object as `globalThis.__odysseum`, so that the plugin's build can
 * resolve `import ... from 'vue'` to the host's Vue (see the views plugin's Vite config).
 */
import type { Component } from 'vue'
import type { DocumentDetails, DocumentSummary, Folder, ProjectSnapshot, ViewSettings } from '../models'

export type { DocumentDetails, DocumentKind, DocumentStatus, DocumentSummary, Folder, Link, ProjectInfo, ProjectSnapshot, ViewSettings } from '../models'

export const PLUGIN_API_VERSION = 2

/** One child of a folder, in the folder's order. A folder's own document is never one of them. */
export type ViewItem =
  | { type: 'folder'; id: string; title: string; folder: Folder; document?: never }
  | { type: 'document'; id: string; title: string; document: DocumentSummary; folder?: never }

/** The props the host gives a view component. All of them are reactive and read-only. */
export interface ViewProps {
  /** The folder the view shows. */
  folder: Folder
  /** The folder's children, in order. */
  items: ViewItem[]
  /** This view's settings for this folder: `folder.views[name]`, or an empty object. */
  settings: ViewSettings
  /** The whole project, for views that show more than one folder. */
  project: ProjectSnapshot
}

/** The events a view sends. The host puts each change in the offline queue, so a view needs no code for offline use. */
export interface ViewEmits {
  /** Opens a document in the editor, or a folder in its pinned view. */
  open: [itemId: string]
  /** Puts a document or folder at `index` among the target folder's children. This is also how the order changes. */
  move: [itemId: string, targetFolderId: string, index: number]
  /** Replaces this view's settings for this folder. Null removes them. */
  saveSettings: [settings: ViewSettings | null]
  /** Changes some details of a document; the others keep their values. */
  updateDetails: [documentId: string, patch: Partial<DocumentDetails>]
  link: [firstDocumentId: string, secondDocumentId: string]
  unlink: [linkId: string]
  setLinkNote: [linkId: string, note: string]
  /** Opens the host's dialog to make a document in that folder. */
  createDocument: [folderId: string]
}

/**
 * Components the host shares, so that plugin views look like the rest of the app and follow its theme. Plugin templates
 * get them from `odysseum.ui`, for example `const { Button } = odysseum.ui` in `setup`.
 *
 * - `Button`: props `label?`, `icon?: Component`, `color?`, `variant?`, `size?`, `disabled?`, `ariaLabel?`; a default slot.
 * - `Icon`: props `icon?: Component` (an SVG the plugin ships) or `item?: ViewItem | DocumentSummary` (the host's icon for it).
 * - `Badge`: props `label?`, `color?`, `variant?`, `size?`; a default slot.
 * - `Select`: props `modelValue`, `items: { label, value }[]`, `ariaLabel?`; event `update:modelValue`.
 * - `Textarea`: props `modelValue`, `rows?`, `autoresize?`, `placeholder?`, `ariaLabel?`, `maxlength?`; event `update:modelValue`.
 * - `ItemCard`: props `item: ViewItem`, `compact?`; event `open`; a default slot below the card's text.
 */
export interface ComponentKit {
  Button: Component
  Icon: Component
  Badge: Component
  Select: Component
  Textarea: Component
  ItemCard: Component
}

export interface OdysseumPluginApi {
  readonly apiVersion: typeof PLUGIN_API_VERSION
  /** The host's Vue. Plugins must not bundle their own. */
  readonly vue: typeof import('vue')
  readonly ui: ComponentKit
}

/** What a view's client entry exports. */
export interface ViewModule { default: Component }
