# Upload directly to private storage

Legal-corpus and Organization Evidence files will use short-lived, server-authorized upload sessions so clients send bytes directly to their private Supabase Storage bucket. A completion command verifies the uploaded object before creating the immutable version and processing work; abandoned sessions expire and are cleaned up, avoiding web-server body and duration limits without granting direct database access.
