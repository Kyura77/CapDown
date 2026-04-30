# 08 — CAPDOWN: API e UX

## Endpoints Atuais Inferidos

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/api/health` | Health check básico | Não |
| GET | `/api/search` | Busca multi-provider | Não (GET público) |
| GET | `/api/library` | Lista mangas da biblioteca | Não |
| GET | `/api/library/:id` | Detalhes do manga | Não |
| GET | `/api/library/:id/chapters/:cid` | Páginas do capítulo | Não |
| GET | `/api/library/file/:fileId` | Proxy de imagem Telegram | Não |
| POST | `/api/downloads` | Criar job de download | Sim |
| GET | `/api/downloads` | Listar jobs | Sim |
| GET | `/api/downloads/:id` | Status do job | Sim |
| DELETE | `/api/downloads/:id` | Cancelar job | Sim |
| GET | `/api/settings` | Obter configurações | Sim |
| PUT | `/api/settings` | Salvar configurações | Sim |
| GET | `/api/providers` | Listar providers disponíveis | Não |
| GET | `/api/preview` | Preview de obra por URL | Sim |
| POST | `/api/scrape` | Acionar scrape manual | Sim |
| GET/POST | `/api/auth/*` | Autenticação de providers | Sim |

---

## Endpoints Faltantes

### Essenciais

```
GET  /api/sources/health
     → Estado de cada provider: {provider_id, status, last_check, error_rate, avg_ms}

GET  /api/sources/capabilities
     → O que cada provider suporta

GET  /api/library/:id/sync
     → Verificar se há novos capítulos para um manga específico

POST /api/downloads/:id/retry
     → Retentar job falho (ou capítulo específico)

DELETE /api/library/:id
       → Remover manga da biblioteca (com confirmação de cascade)

GET /api/library/stats
    → Total de obras, capítulos, páginas, tamanho estimado em MB
```

### Admin/Debug

```
GET  /api/admin/jobs?status=failed&limit=20
GET  /api/admin/quarantine
POST /api/admin/quarantine/:id/approve
POST /api/admin/quarantine/:id/reject
GET  /api/admin/logs?last=50
POST /api/admin/sources/:id/quarantine
POST /api/admin/sources/:id/restore
GET  /api/admin/cache/stats
POST /api/admin/cache/clear
```

### SSE (Server-Sent Events)

```
GET /api/downloads/:id/stream
    → Stream de progresso em tempo real
    → Events: {type: 'progress', downloadedPages, totalPages, currentChapter}
    → Events: {type: 'completed', chapters: [...]}
    → Events: {type: 'error', kind, message, retrying: bool}
```

---

## Problemas de UX/API Atuais

### U01 — Polling manual de progresso
UI precisa fazer GET a cada X segundos para saber se download terminou. SSE resolve isso. Sem SSE, UX do download é confusa.

### U02 — Sem feedback quando Redis está offline
Usuário clica "Download", request retorna 200, mas nenhum download acontece. Sem mensagem de erro.
**Fix**: Queue que falha deve retornar 503 com `{error: "queue_unavailable", fallback: "in_memory"}`.

### U03 — Endpoint `/api/search` sem paginação
Um provider pode retornar 100 resultados. Sem cursor/offset/limit bem documentado.

### U04 — GET de biblioteca expõe todos os capítulos em uma resposta
`GET /api/library/:id` retorna manga com todos os capítulos e páginas. Com 300 capítulos de 200 páginas, isso é 60.000 registros em uma resposta.
**Fix**: Paginar capítulos. Páginas só em `GET /api/library/:id/chapters/:cid`.

### U05 — Sem indicador de fonte degradada na UI de busca
Se a Verdinha estiver offline, o resultado de busca silenciosamente não inclui resultados dela. Usuário acha que não existe obra.
**Fix**: Busca deve retornar `{results: [...], sources_status: {verdinha: 'offline', egotoons: 'healthy'}}`.

### U06 — Sem endpoint de progresso de leitura por API
`useReaderStore` salva progresso em LocalStorage. Se usuário troca de dispositivo, perde progresso.
**Fix**: `POST /api/library/:id/progress` com `{chapter_id, page_index}`.

---

## Contratos de Resposta Padronizados

### Sucesso
```typescript
// Singular
{ data: T, meta?: { cache_hit: bool, source: string } }

// Lista
{ data: T[], meta: { total: number, page: number, limit: number } }
```

### Erro
```typescript
{
  error: {
    code: string,       // 'unauthorized' | 'not_found' | 'provider_offline' | 'queue_unavailable' | ...
    message: string,    // Mensagem legível por humano
    details?: unknown,  // Informação extra para debug
    request_id: string  // Para correlação de logs
  }
}
```

### Status HTTP obrigatórios
| Situação | Status |
|----------|--------|
| Provider offline | 503 com `provider_id` no erro |
| Job não encontrado | 404 |
| Job duplicado | 409 (não criar segundo job para mesmo chapter) |
| Redis offline | 503 com `fallback` indicando modo degradado |
| Schema Zod inválido | 422 |
| API Key ausente/inválida | 401 |

---

## Telas/Painéis Recomendados

### Painel Admin (nova página `/admin`)

```
┌──────────────────────────────────────────────────────────┐
│  CapDown Admin                           [Última atualização: há 2min] │
├──────────────────────────────────────────────────────────┤
│  FONTES                                                   │
│  ✅ verdinha    avg 340ms  99.2% sucesso  Último OK: agora│
│  ⚠️  egotoons   avg 1200ms  73% sucesso   Último OK: 12min│
│  ❌ madara      QUARENTENADO até 15:30                    │
├──────────────────────────────────────────────────────────┤
│  FILA DE DOWNLOADS                                        │
│  Em execução: 2  |  Aguardando: 7  |  Falhos: 1          │
│                                                           │
│  ██████████░░ One Piece cap 1100  [72%] ▶ ⏹              │
│  ░░░░░░░░░░░░ Berserk cap 360     [queued]                │
│  ⚠ Naruto cap 700  FALHOU: network_timeout  [RETRY] [DEL] │
├──────────────────────────────────────────────────────────┤
│  QUARENTENA (3 items)                                     │
│  Resultado com título vazio  verdinha  [APROVAR] [REJEITAR]│
│  Capa retornou 404            egotoons [APROVAR] [REJEITAR]│
│  Encoding UTF-8 inválido      madara   [APROVAR] [REJEITAR]│
└──────────────────────────────────────────────────────────┘
```

### Melhorias na UI de Busca

1. **Badge de status por fonte** ao lado do nome do provider nos filtros
2. **Indicador de deduplicação**: "2 fontes encontradas" no card de resultado
3. **Score visível** em modo debug (feature flag)

### Melhorias no Reader

1. **Progresso sincronizado com API** (não só localStorage)
2. **Retry automático** de imagem quebrada (URL expirada)
3. **Indicador de "offline mode"** quando servidor local não está acessível
