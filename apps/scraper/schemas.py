from typing import List, Optional
from pydantic import BaseModel, Field

class SourceResult(BaseModel):
    provider_id: str
    source_id: str
    title: str
    slug: str
    source_url: str
    cover_url: Optional[str] = None
    total_chapters: Optional[int] = None
    description: Optional[str] = None

class UnifiedSearchResult(BaseModel):
    title: str
    cover_url: Optional[str] = None
    description: Optional[str] = None
    score: float
    sources: List[SourceResult]

class ChapterPreview(BaseModel):
    source_id: str
    title: str
    number: Optional[str] = None
    source_url: str

class PreviewResponse(BaseModel):
    provider_id: str
    source_id: str
    title: str
    source_url: str
    cover_url: Optional[str] = None
    chapters: List[ChapterPreview]

class PageResult(BaseModel):
    index: int
    filename: str
    url: str

class SearchRequest(BaseModel):
    provider_id: str
    q: str
    limit: int = 20
    page: int = 1
    deep: bool = False

class PreviewRequest(BaseModel):
    provider_id: str
    url: str

class ChapterRequest(BaseModel):
    provider_id: str
    source_id: str
    source_url: Optional[str] = None
