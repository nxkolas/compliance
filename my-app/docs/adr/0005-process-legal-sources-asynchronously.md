# Process legal sources asynchronously

Legal-source uploads will create durable source versions and background processing jobs rather than parsing, OCR, chunking, and embedding inside the request. Processing is retryable and observable, and a Legal Corpus Release cannot be published while any included version is incomplete or failed; the existing organization-evidence pipeline may remain synchronous until it is migrated separately.
