import assert from "node:assert/strict";
import test from "node:test";
import {
  UnsupportedProviderSelectionError,
  listProviderCatalog,
  previewProviderSource,
  searchProviders,
} from "../src/services/providers.js";

type FetchStubResponse = {
  body: unknown;
  status?: number;
};

async function withFetchStub<T>(
  responses: FetchStubResponse[],
  run: (requests: string[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    const next = responses.shift();

    if (!next) {
      throw new Error("Unexpected fetch call");
    }

    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: {
        "content-type": "application/json",
      },
    });
  }) as typeof fetch;

  try {
    return await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("provider catalog exposes Verdinha, MangaDex and EgoToons as enabled", () => {
  const catalog = listProviderCatalog();
  const enabledIds = catalog.filter(p => p.status === 'enabled').map(p => p.id);
  assert.ok(enabledIds.includes("verdinha"), 'verdinha should be enabled');
  assert.ok(enabledIds.includes("manga_dex"), 'manga_dex should be enabled');
  assert.ok(enabledIds.includes("ego_toons"), 'ego_toons should be enabled');

  // Providers without adapters should be unavailable
  const unavailableIds = catalog.filter(p => p.status === 'unavailable').map(p => p.id);
  assert.ok(!unavailableIds.includes("verdinha"), 'verdinha should not be unavailable');
});

test("search routes Verdinha queries to the Verdinha API", async () => {
  await withFetchStub(
    [
      {
        body: {
          obras: [
            {
              obr_id: 13669,
              obr_nome: "Roteiro Quebrado",
              obr_slug: "roteiro-quebrado",
              obr_descricao: "Do autor de Ending Maker!",
              obr_imagem: "68afa35b6bf4c.webp",
              scan_id: 1,
              total_capitulos: 80,
            },
          ],
          pagina: 1,
          limite: 3,
          total: 1,
          totalPaginas: 1,
        },
      },
    ],
    async (requests) => {
      const outcome = await searchProviders({
        q: "solo leveling",
        limit: 3,
        page: 1,
        deep: false,
        providers: "verdinha",
      });

      assert.deepEqual(outcome.providers, ["verdinha"]);
      assert.equal(outcome.results.length, 1);
      assert.equal(outcome.results[0].sources[0].provider_id, "verdinha");
      assert.equal(outcome.results[0].sources[0].source_url, "https://api.verdinha.wtf/obras/roteiro-quebrado");
      assert.equal(outcome.results[0].cover_url, "https://api.verdinha.wtf/cdn/scans/1/obras/13669/68afa35b6bf4c.webp?width=400");
      assert.equal(outcome.results[0].sources[0].cover_url, "https://api.verdinha.wtf/cdn/scans/1/obras/13669/68afa35b6bf4c.webp?width=400");
      assert.equal(outcome.results[0].sources[0].total_chapters, 80);
      assert.equal(requests.length, 1);
      assert.match(requests[0], /api\.verdinha\.wtf\/obras\/buscar/);
    },
  );
});

test("deep Verdinha search ranks an exact title match ahead of later pages", async () => {
  await withFetchStub(
    [
      {
        body: {
          obras: [
            {
              obr_id: 14511,
              obr_nome: "Que Se Foda o Sistema",
              obr_slug: "que-se-foda-o-sistema",
              obr_descricao: "O homem mais forte dos Murim...",
              total_capitulos: 16,
            },
            {
              obr_id: 14459,
              obr_nome: "Não odeie o jogador",
              obr_slug: "nao-odeie-o-jogador",
              obr_descricao: "Player-themed result",
              total_capitulos: 39,
            },
            {
              obr_id: 14509,
              obr_nome: "Streamer Após a Reencarnação",
              obr_slug: "streamer-apos-a-reencarnacao",
              obr_descricao: "Player-themed result",
              total_capitulos: 46,
            },
            {
              obr_id: 14722,
              obr_nome: "O Retorno do Ranker Inigualável",
              obr_slug: "o-retorno-do-ranker-inigualavel",
              obr_descricao: "Player-themed result",
              total_capitulos: 21,
            },
            {
              obr_id: 12921,
              obr_nome: "Namorada Cosplayer",
              obr_slug: "namorada-cosplayer",
              obr_descricao: "Player-themed result",
              total_capitulos: 19,
            },
          ],
          pagina: 1,
          limite: 5,
          total: 6,
          totalPaginas: 3,
        },
      },
      {
        body: {
          obras: [
            {
              obr_id: 10820,
              obr_nome: "Diário de Criação de Sub-Caracteres do Melhor do Mundo",
              obr_slug: "diario-de-criacao-de-sub-caracteres-do-melhor-do-mundo",
              obr_descricao: "Player-themed result",
              total_capitulos: 45,
            },
            {
              obr_id: 10045,
              obr_nome: "Super Jogador",
              obr_slug: "super-jogador",
              obr_descricao: "Player-themed result",
              total_capitulos: 10,
            },
            {
              obr_id: 10046,
              obr_nome: "O Jogador da Família Caída",
              obr_slug: "o-jogador-da-familia-caida",
              obr_descricao: "Player-themed result",
              total_capitulos: 15,
            },
            {
              obr_id: 10047,
              obr_nome: "A Volta do Jogador",
              obr_slug: "a-volta-do-jogador",
              obr_descricao: "Player-themed result",
              total_capitulos: 23,
            },
            {
              obr_id: 10048,
              obr_nome: "O Jogo do Cultivo Imortal",
              obr_slug: "o-jogo-do-cultivo-imortal",
              obr_descricao: "Player-themed result",
              total_capitulos: 30,
            },
          ],
          pagina: 2,
          limite: 5,
          total: 6,
          totalPaginas: 3,
        },
      },
      {
        body: {
          obras: [
            {
              obr_id: 10049,
              obr_nome: "O Jogador",
              obr_slug: "o-jogador",
              obr_descricao: "Exact title match",
              total_capitulos: 511,
            },
          ],
          pagina: 3,
          limite: 5,
          total: 6,
          totalPaginas: 3,
        },
      },
    ],
    async (requests) => {
      const outcome = await searchProviders({
        q: "o jogador",
        limit: 5,
        page: 1,
        deep: true,
        providers: "verdinha",
      });

      assert.equal(outcome.results[0].title, "O Jogador");
      assert.equal(outcome.results[0].sources[0].source_id, "10049");
      assert.equal(requests.length, 3);
      assert.match(requests[0], /pagina=1/);
      assert.match(requests[1], /pagina=2/);
      assert.match(requests[2], /pagina=3/);
    },
  );
});

test("search routes MangaDex queries to the MangaDex API", async () => {
  await withFetchStub(
    [
      {
        body: {
          result: "ok",
          response: "collection",
          data: [
            {
              id: "abc-123",
              attributes: {
                title: {
                  en: "Solo Leveling",
                },
                description: {
                  en: "Description",
                },
                lastChapter: "10",
              },
              relationships: [
                {
                  type: "cover_art",
                  attributes: {
                    fileName: "cover.jpg",
                  },
                },
              ],
            },
          ],
          total: 1,
        },
      },
    ],
    async (requests) => {
      const outcome = await searchProviders({
        q: "solo leveling",
        limit: 2,
        page: 1,
        deep: false,
        providers: "manga_dex",
      });

      assert.deepEqual(outcome.providers, ["manga_dex"]);
      assert.equal(outcome.results.length, 1);
      assert.equal(outcome.results[0].sources[0].provider_id, "manga_dex");
      assert.equal(outcome.results[0].sources[0].cover_url, "https://uploads.mangadex.org/covers/abc-123/cover.jpg");
      assert.equal(requests.length, 1);

      const requestUrl = new URL(requests[0]);
      assert.equal(requestUrl.hostname, "api.mangadex.org");
      assert.equal(requestUrl.pathname, "/manga");
      assert.equal(requestUrl.searchParams.get("title"), "solo leveling");
      assert.equal(requestUrl.searchParams.get("limit"), "2");
      assert.equal(requestUrl.searchParams.get("offset"), "0");
    },
  );
});

test("preview routes Verdinha obra detail payloads to chapter lists", async () => {
  await withFetchStub(
    [
      {
        body: {
          obr_id: 13669,
          obr_nome: "Roteiro Quebrado",
          obr_slug: "roteiro-quebrado",
          obr_descricao: "Do autor de Ending Maker!",
          obr_imagem: "68afa35b6bf4c.webp",
          scan_id: 1,
          capitulos: [
            {
              cap_id: 302737,
              cap_nome: "Capítulo 2",
              cap_numero: 2,
              cap_liberado: true,
            },
            {
              cap_id: 302735,
              cap_nome: "Capítulo 1",
              cap_numero: 1,
              cap_liberado: true,
            },
            {
              cap_id: 999999,
              cap_nome: "Escondido",
              cap_numero: 999,
              cap_liberado: false,
            },
          ],
        },
      },
    ],
    async () => {
      const preview = await previewProviderSource("https://api.verdinha.wtf/obras/13669");

      assert.equal(preview.provider_id, "verdinha");
      assert.equal(preview.source_id, "13669");
      assert.equal(preview.cover_url, "https://api.verdinha.wtf/cdn/scans/1/obras/13669/68afa35b6bf4c.webp?width=400");
      assert.equal(preview.chapters.length, 2);
      assert.equal(preview.chapters[0].source_id, "302735");
      assert.equal(preview.chapters[0].number, "1");
      assert.equal(preview.chapters[0].source_url, "https://api.verdinha.wtf/obras/13669");
    },
  );
});

test("preview routes legacy Verdinha hash URLs to the API detail payload", async () => {
  await withFetchStub(
    [
      {
        body: {
          obr_id: 849,
          obr_nome: "O Filho Caçula do Conde é um Jogador",
          obr_slug: "o-filho-cacula-do-conde-e-um-jogador",
          obr_descricao: "Legacy record",
          obr_imagem: "6861eb1c198cf.png",
          scan_id: 1,
          capitulos: [],
        },
      },
    ],
    async (requests) => {
      const preview = await previewProviderSource("https://verdinha.wtf/#/obras/o-filho-cacula-do-conde-e-um-jogador");

      assert.equal(preview.provider_id, "verdinha");
      assert.equal(preview.source_id, "849");
      assert.equal(preview.cover_url, "https://api.verdinha.wtf/cdn/scans/1/obras/849/6861eb1c198cf.png?width=400");
      assert.equal(requests.length, 1);
      assert.match(requests[0], /api\.verdinha\.wtf\/obras\/o-filho-cacula-do-conde-e-um-jogador/);
    },
  );
});

test("preview routes MangaDex URLs to MangaDex detail and chapter payloads", async () => {
  await withFetchStub(
    [
      {
        body: {
          result: "ok",
          data: {
            id: "abc-123",
            attributes: {
              title: {
                en: "Solo Leveling",
              },
              description: {
                en: "Description",
              },
              lastChapter: "10",
            },
            relationships: [
              {
                type: "cover_art",
                attributes: {
                  fileName: "cover.jpg",
                },
              },
            ],
          },
        },
      },
      {
        body: {
          result: "ok",
          response: "collection",
          data: [
            {
              id: "chapter-2",
              attributes: {
                title: "Second",
                chapter: "2",
              },
            },
            {
              id: "chapter-1",
              attributes: {
                title: "First",
                chapter: "1",
              },
            },
          ],
          total: 2,
        },
      },
    ],
    async (requests) => {
      const preview = await previewProviderSource("https://api.mangadex.org/manga/abc-123");

      assert.equal(preview.provider_id, "manga_dex");
      assert.equal(preview.source_id, "abc-123");
      assert.equal(preview.cover_url, "https://uploads.mangadex.org/covers/abc-123/cover.jpg");
      assert.equal(preview.chapters.length, 2);
      assert.equal(preview.chapters[0].source_id, "chapter-1");
      assert.equal(preview.chapters[0].number, "1");
      assert.equal(preview.chapters[1].source_id, "chapter-2");

      assert.equal(requests.length, 2);
      assert.match(requests[0], /api\.mangadex\.org\/manga\/abc-123/);
      assert.match(requests[1], /api\.mangadex\.org\/chapter/);
    },
  );
});

test("search rejects unsupported provider selections", async () => {
  await assert.rejects(
    () =>
      searchProviders({
        q: "solo leveling",
        limit: 5,
        page: 1,
        deep: false,
        providers: "comick",
      }),
    UnsupportedProviderSelectionError,
  );
});
