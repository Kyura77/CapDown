import httpx
from urllib.parse import urlparse, urlencode
from typing import List, Optional, Any
from schemas import UnifiedSearchResult, SourceResult, PreviewResponse, ChapterPreview, PageResult, SearchRequest

VERDINHA_API_BASE = "https://api.verdinha.wtf"

def to_optional_integer(val: Any) -> Optional[int]:
    try:
        if val is None:
            return None
        return int(val)
    except (ValueError, TypeError):
        return None

def truncate_text(text: Optional[str], length: int) -> Optional[str]:
    if not text:
        return text
    text = text.strip()
    if len(text) > length:
        return text[:length-3] + "..."
    return text

def build_cover_url(obra_id: str, scan_id: Any, image_name: Optional[str]) -> Optional[str]:
    if not image_name:
        return None
    image_name = image_name.strip()
    if not image_name:
        return None
    
    normalized_scan_id = to_optional_integer(scan_id) or 1
    return f"{VERDINHA_API_BASE}/cdn/scans/{normalized_scan_id}/obras/{obra_id}/{image_name}?width=400"

async def search(req: SearchRequest) -> List[UnifiedSearchResult]:
    params = {
        "q": req.q,
        "limite": req.limit,
        "pagina": req.page
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{VERDINHA_API_BASE}/obras/buscar", params=params)
        response.raise_for_status()
        data = response.json()
        
        results = []
        for index, obra in enumerate(data.get("obras", [])):
            source_id = str(obra.get("obr_id"))
            slug = str(obra.get("obr_slug") or "").strip() or source_id
            title = str(obra.get("obr_nome")).strip()
            description = truncate_text(obra.get("obr_descricao"), 200)
            cover_url = build_cover_url(source_id, obra.get("scan_id"), obra.get("obr_imagem"))
            
            score = max(0.0, 1.0 - index * 0.01)
            
            source = SourceResult(
                provider_id="verdinha",
                source_id=source_id,
                title=title,
                slug=slug,
                source_url=f"{VERDINHA_API_BASE}/obras/{slug}",
                cover_url=cover_url,
                total_chapters=to_optional_integer(obra.get("total_capitulos")),
                description=description
            )
            
            result = UnifiedSearchResult(
                title=title,
                cover_url=cover_url,
                description=description,
                score=score,
                sources=[source]
            )
            results.append(result)
            
        return results

async def preview(url: str) -> PreviewResponse:
    parsed = urlparse(url)
    
    # Resolve URL to API
    api_url = url
    if parsed.hostname == "verdinha.wtf" or parsed.hostname == "api.verdinha.wtf":
        if parsed.path.startswith("/obras/"):
            api_url = f"{VERDINHA_API_BASE}{parsed.path}"
        elif parsed.fragment.startswith("/obras/"):
            api_url = f"{VERDINHA_API_BASE}{parsed.fragment}"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(api_url)
        response.raise_for_status()
        data = response.json()
        
        source_id = str(data.get("obr_id"))
        title = str(data.get("obr_nome")).strip()
        cover_url = build_cover_url(source_id, data.get("scan_id"), data.get("obr_imagem"))
        
        raw_chapters = data.get("capitulos", [])
        
        chapters = []
        for ch in raw_chapters:
            if ch.get("cap_liberado") is False:
                continue
                
            ch_id = str(ch.get("cap_id"))
            ch_title = str(ch.get("cap_nome")).strip()
            ch_num = ch.get("cap_numero")
            
            chapters.append(ChapterPreview(
                source_id=ch_id,
                title=ch_title,
                number=str(ch_num) if ch_num is not None else None,
                source_url=url
            ))
            
        def sort_key(c: ChapterPreview):
            num = to_optional_integer(c.number)
            if num is None:
                return float('inf')
            return num
            
        chapters.sort(key=sort_key)
        
        return PreviewResponse(
            provider_id="verdinha",
            source_id=source_id,
            title=title,
            source_url=url,
            cover_url=cover_url,
            chapters=chapters
        )

async def get_chapter_pages(source_id: str) -> List[PageResult]:
    url = f"{VERDINHA_API_BASE}/capitulos/{source_id}"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
        
        paginas = data.get("cap_paginas", [])
        results = []
        
        for index, page in enumerate(paginas):
            src = str(page.get("src"))
            path = str(page.get("path"))
            results.append(PageResult(
                index=index + 1,
                filename=src,
                url=f"https://cdn.verdinha.wtf/{path}"
            ))
            
        return results
