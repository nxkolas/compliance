import hmac
import os

from fastapi import Request
from litellm.proxy._types import LitellmUserRoles, UserAPIKeyAuth


async def user_api_key_auth(request: Request, api_key: str) -> UserAPIKeyAuth:
    master_key = os.environ.get("LITELLM_MASTER_KEY", "")
    application_key = os.environ.get("LITELLM_APPLICATION_KEY", "")

    if master_key and hmac.compare_digest(api_key, master_key):
        return UserAPIKeyAuth(
            api_key=api_key,
            user_id="ai-host-administrator",
            user_role=LitellmUserRoles.PROXY_ADMIN,
        )
    if application_key and hmac.compare_digest(api_key, application_key):
        return UserAPIKeyAuth(
            api_key=api_key,
            user_id="compliancetool-application",
            team_id="compliancetool",
            user_role=LitellmUserRoles.INTERNAL_USER,
            models=["compliance-chat", "compliance-embedding"],
            max_parallel_requests=2,
        )
    raise Exception("Invalid API key")
