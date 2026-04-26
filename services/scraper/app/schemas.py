from typing import Literal

from pydantic import BaseModel, HttpUrl


class ScrapeRequest(BaseModel):
    provider: str
    url: HttpUrl
    mode: Literal["manga", "chapter", "search"]


class ScrapeResponse(BaseModel):
    status: str
    provider: str
    url: HttpUrl
    mode: Literal["manga", "chapter", "search"]
