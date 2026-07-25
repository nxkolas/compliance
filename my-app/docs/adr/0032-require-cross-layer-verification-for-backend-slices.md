# Require cross-layer verification for backend slices

A backend slice is complete only when its shared schema and typed client agree, route authentication and validation are tested, service and database constraints are exercised, and its authorization, idempotency, and concurrency behavior are verified. Worker-backed slices also require retry and cancellation tests, while AI consumers require grounding and citation evaluations.
