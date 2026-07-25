# Run long-lived generation as jobs

Gap-Analyse generation, PDF creation, and future long-running AI operations will execute as durable worker jobs rather than holding HTTP requests open. Commands return `202 Accepted` with a job or run resource for polling, retries remain explicit and idempotent, and current accepted business results stay authoritative until a generated candidate completes review and approval.
