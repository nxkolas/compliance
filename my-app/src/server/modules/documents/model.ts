

export type DocumentStorage = {
  upload(input: { bucket: string; path: string; bytes: Uint8Array; contentType: string }): Promise<void>;
  remove(input: { bucket: string; path: string }): Promise<void>;
};

export type UploadOrganizationDocumentCommand = {
  userId: string;
  organizationId: string;
  title: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type UploadOrganizationDocumentVersionCommand = Omit<UploadOrganizationDocumentCommand, "title"> & { documentId: string };
