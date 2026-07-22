# Run ingestion in a dedicated Node worker

Legal-source processing will run in a separately deployed trusted Node worker that claims durable PostgreSQL jobs using leases and idempotent handlers. This preserves compatibility with the existing Node parsing, AI, Drizzle, and Supabase Storage code while allowing OCR and long-running processing without coupling the workflow to web-request limits or a proprietary queue service.
