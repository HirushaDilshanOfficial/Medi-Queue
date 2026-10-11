import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';

export function appendReportFile(form: FormData, asset: DocumentPickerAsset): void {
  if (asset.file) {
    // Keep the browser's existing File upload unchanged.
    form.append('file', asset.file);
    return;
  }

  // SDK 57's native fetch serializes blobs, not React Native URI descriptors.
  // The picker already copies the document to cache before this is called.
  const file = new File(asset.uri);
  form.append('file', file.slice(0, file.size, asset.mimeType || file.type), asset.name || file.name);
}
