export function requestTabId(
  collection: string,
  folder: string[] | null,
  request: string
): string {
  const folderPart = folder && folder.length > 0 ? folder.join('/') : '';
  return `${collection}\n${folderPart}\n${request}`;
}
