from fastapi import FastAPI, HTTPException
from schemas import SearchRequest, PreviewRequest, ChapterRequest, UnifiedSearchResult, PreviewResponse, PageResult
from providers import verdinha, egotoons
from typing import List
import uvicorn

app = FastAPI(title="CapDown Scraper API")

@app.post("/api/scrape/search", response_model=List[UnifiedSearchResult])
async def search_endpoint(req: SearchRequest):
    if req.provider_id == "verdinha":
        try:
            return await verdinha.search(req)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Verdinha search failed: {str(e)}")
    elif req.provider_id == "ego_toons":
        try:
            return await egotoons.search(req)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"EgoToons search failed: {str(e)}")
    
    raise HTTPException(status_code=400, detail=f"Provider {req.provider_id} not supported yet in Python Scraper")

@app.post("/api/scrape/preview", response_model=PreviewResponse)
async def preview_endpoint(req: PreviewRequest):
    if req.provider_id == "verdinha":
        try:
            return await verdinha.preview(req.url)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Verdinha preview failed: {str(e)}")
    elif req.provider_id == "ego_toons":
        try:
            return await egotoons.preview(req.url)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"EgoToons preview failed: {str(e)}")
            
    raise HTTPException(status_code=400, detail=f"Provider {req.provider_id} not supported yet in Python Scraper")

@app.post("/api/scrape/chapter", response_model=List[PageResult])
async def chapter_endpoint(req: ChapterRequest):
    if req.provider_id == "verdinha":
        try:
            return await verdinha.get_chapter_pages(req.source_id)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Verdinha chapter fetch failed: {str(e)}")
    elif req.provider_id == "ego_toons":
        try:
            return await egotoons.get_chapter_pages(req.source_id, req.source_url)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"EgoToons chapter fetch failed: {str(e)}")
            
    raise HTTPException(status_code=400, detail=f"Provider {req.provider_id} not supported yet in Python Scraper")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "capdown-scraper-python"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=4541, reload=True)
