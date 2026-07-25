# Centralize production AI grounding

Every production AI feature will call a shared server-side Grounding Gateway that applies the feature's source policy, retrieves only permitted legal and organization channels, assigns citation IDs, validates grounded output, and records provenance. Gap analysis is the first consumer; future assistants, summaries, reports, and recommendations may not call model providers directly, while deterministic applicability evaluation remains AI-free.
