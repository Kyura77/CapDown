import httpx
from bs4 import BeautifulSoup
from typing import List, Optional
from urllib.parse import urlparse, urljoin
from schemas import UnifiedSearchResult, SourceResult, PreviewResponse, ChapterPreview, PageResult, SearchRequest
import re

class MadaraProvider:
    def __init__(self, provider_id: str, base_url: str):
        self.provider_id = provider_id
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=15.0, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        })

    def truncate_text(self, text: Optional[str], length: int) -> Optional[str]:
        if not text: return text
        text = text.strip()
        if len(text) > length:
            return text[:length-3] + "..."
        return text

    async def search(self, req: SearchRequest) -> List[UnifiedSearchResult]:
        url = f"{self.base_url}/"
        params = {"s": req.q, "post_type": "wp-manga"}
        
        response = await self.client.get(url, params=params)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        items = soup.select(".c-tabs-item__content")
        
        results = []
        for index, item in enumerate(items):
            title_el = item.select_one(".post-title a")
            if not title_el: continue
            
            title = title_el.text.strip()
            source_url = title_el["href"]
            source_id = source_url.rstrip("/").split("/")[-1]
            
            img_el = item.select_one("img")
            cover_url = img_el["src"] if img_el else None
            # Handle lazy loading attributes
            if img_el and "data-src" in img_el.attrs:
                cover_url = img_el["data-src"]
                
            score = max(0.0, 1.0 - index * 0.01)
            
            source = SourceResult(
                provider_id=self.provider_id,
                source_id=source_id,
                title=title,
                slug=source_id,
                source_url=source_url,
                cover_url=cover_url,
                total_chapters=None,
                description=None
            )
            
            results.append(UnifiedSearchResult(
                title=title,
                cover_url=cover_url,
                description=None,
                score=score,
                sources=[source]
            ))
            
        return results

    async def preview(self, url: str) -> PreviewResponse:
        response = await self.client.get(url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        title_el = soup.select_one(".post-title h1")
        title = title_el.text.strip() if title_el else "Unknown Title"
        
        img_el = soup.select_one(".summary_image img")
        cover_url = img_el["src"] if img_el else None
        if img_el and "data-src" in img_el.attrs:
            cover_url = img_el["data-src"]
            
        source_id = url.rstrip("/").split("/")[-1]
        
        # In many Madara themes, chapters are loaded via Ajax, 
        # but sometimes they are embedded. Let's try embedded first.
        chapter_els = soup.select("li.wp-manga-chapter")
        
        if not chapter_els:
            # Try to load via AJAX if embedded fails
            manga_id_el = soup.select_one("#manga-chapters-holder")
            manga_id = manga_id_el["data-id"] if manga_id_el else None
            
            if manga_id:
                ajax_url = f"{self.base_url}/wp-admin/admin-ajax.php"
                ajax_resp = await self.client.post(ajax_url, data={
                    "action": "manga_get_chapters",
                    "manga": manga_id
                })
                if ajax_resp.status_code == 200:
                    ajax_soup = BeautifulSoup(ajax_resp.text, "html.parser")
                    chapter_els = ajax_soup.select("li.wp-manga-chapter")
        
        chapters = []
        for ch in chapter_els:
            a_el = ch.select_one("a")
            if not a_el: continue
            
            ch_url = a_el["href"]
            ch_title = a_el.text.strip()
            ch_id = ch_url.rstrip("/").split("/")[-1]
            
            # Extract number from title if possible
            match = re.search(r'\d+', ch_title)
            ch_num = match.group(0) if match else None
            
            chapters.append(ChapterPreview(
                source_id=ch_id,
                title=ch_title,
                number=ch_num,
                source_url=ch_url
            ))
            
        # Madara usually orders newest first, so we reverse to get oldest first
        chapters.reverse()
        
        return PreviewResponse(
            provider_id=self.provider_id,
            source_id=source_id,
            title=title,
            source_url=url,
            cover_url=cover_url,
            chapters=chapters
        )

    async def get_chapter_pages(self, source_id: str, chapter_url: str) -> List[PageResult]:
        # For Madara, we need the exact chapter URL to fetch pages
        response = await self.client.get(chapter_url)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        
        images = soup.select(".reading-content img")
        if not images:
            images = soup.select(".page-break img")
            
        results = []
        for index, img in enumerate(images):
            url = img.get("data-src") or img.get("src")
            if not url: continue
            
            url = url.strip()
            filename = url.split("/")[-1].split("?")[0]
            if not filename:
                filename = f"page_{index+1}.jpg"
                
            results.append(PageResult(
                index=index + 1,
                filename=filename,
                url=url
            ))
            
        return results
