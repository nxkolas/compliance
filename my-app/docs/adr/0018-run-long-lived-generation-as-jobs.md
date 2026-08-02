# Run long-lived generation as jobs

Status: amended 2 August 2026.

Gap Analysis, one-finding conflict resolution, Action Plan generation, report
rendering, document indexing, legal-source processing, and maintenance cleanup
execute as durable worker jobs rather than holding HTTP requests open. Commands
return `202 Accepted` for polling. Successful validated analysis generation
atomically makes its immutable revision current; there is no candidate,
accepted-result, review, or approval state.

Jobs retain attempts, leasing, heartbeat, progress, cancellation request,
payload, errors, requester, and organization scope. Result locators are stored
inline. Cancellation and authorization are derived from stable job kind and the
current caller role.
