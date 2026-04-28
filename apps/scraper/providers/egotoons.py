from .madara import MadaraProvider
from schemas import SearchRequest, PreviewResponse, PageResult, UnifiedSearchResult
from typing import List

class EgoToonsProvider(MadaraProvider):
    def __init__(self):
        super().__init__(
            provider_id="ego_toons",
            base_url="https://egotoons.com"
        )

# Instantiate a global instance to be used by main.py
egotoons_provider = EgoToonsProvider()

async def search(req: SearchRequest) -> List[UnifiedSearchResult]:
    return await egotoons_provider.search(req)

async def preview(url: str) -> PreviewResponse:
    return await egotoons_provider.preview(url)

async def get_chapter_pages(source_id: str, chapter_url: str = None) -> List[PageResult]:
    # Madara requires the chapter URL to get pages
    if not chapter_url:
        # Fallback if the backend didn't pass the chapter url, we assume source_id is the full slug
        chapter_url = f"{egotoons_provider.base_url}/{source_id}"
    return await egotoons_provider.get_chapter_pages(source_id, chapter_url)
