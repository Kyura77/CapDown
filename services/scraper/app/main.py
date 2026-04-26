from fastapi import FastAPI

from .schemas import ScrapeRequest, ScrapeResponse


app = FastAPI(title="CapDown Scraper Service", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "capdown-v2-scraper",
        "runtime": "python",
    }


@app.post("/scrape", response_model=ScrapeResponse, status_code=202)
async def scrape(request: ScrapeRequest) -> ScrapeResponse:
    return ScrapeResponse(
        status="accepted",
        provider=request.provider,
        url=request.url,
        mode=request.mode,
    )
