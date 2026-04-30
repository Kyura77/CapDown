# Limpeza Total do Projeto CapDown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar redundâncias, unificar o código (Python e TS) e garantir que a arquitetura siga padrões modernos de Clean Code sem perder a tipagem atual.

**Architecture:** Monorepo com frontend React, backend Fastify + Prisma + BullMQ (TypeScript) e scraper em Python.

**Tech Stack:** React, Fastify, TypeScript, Prisma, BullMQ, Python

---

### Task 1: Limpeza da Raiz e Movimentação de Documentos

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\AUDITORIA_CODIGO.md`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\PLANO_DE_IMPLEMENTACAO.md`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\PLANO_FASE_4.md`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\RALPH_LOOP_PLAN.md`

- [ ] **Step 1: Criar diretório e mover arquivos MD**

Use a ferramenta `run_shell_command` para mover os arquivos de planejamento da raiz para `docs/plans/`.

```powershell
New-Item -ItemType Directory -Force -Path "C:\Users\cd250\Downloads\Projetos\CapDown\docs\plans"
Move-Item -Path "C:\Users\cd250\Downloads\Projetos\CapDown\AUDITORIA_CODIGO.md", "C:\Users\cd250\Downloads\Projetos\CapDown\PLANO_DE_IMPLEMENTACAO.md", "C:\Users\cd250\Downloads\Projetos\CapDown\PLANO_FASE_4.md", "C:\Users\cd250\Downloads\Projetos\CapDown\RALPH_LOOP_PLAN.md" -Destination "C:\Users\cd250\Downloads\Projetos\CapDown\docs\plans\" -Force
```

### Task 2: Unificação do Scraper

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\services` (Deletar)

- [ ] **Step 1: Deletar o diretório services/**

Como o conteúdo funcional já existe em `apps/scraper` (que contém o `main.py`, `schemas.py` e ambiente Python configurado), a pasta `services` deve ser removida da raiz para manter o monorepo limpo. Use a ferramenta `run_shell_command`.

```powershell
Remove-Item -Path "C:\Users\cd250\Downloads\Projetos\CapDown\services" -Recurse -Force
```

### Task 3: Criação do Logger Padronizado

**Files:**
- Create: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\utils\logger.ts`

- [ ] **Step 1: Criar o arquivo de logger estruturado**

Use a ferramenta `write_file` para criar o logger, mantendo a tipagem TS correta.

```typescript
export const logger = {
  info: (message: string, ...meta: any[]) => {
    console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...meta);
  },
  error: (message: string, ...meta: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...meta);
  },
  warn: (message: string, ...meta: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...meta);
  },
  debug: (message: string, ...meta: any[]) => {
    console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...meta);
  }
};
```

### Task 4: Substituição de Logs no Backend

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\services\download-worker.ts`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\store\product-state-service.ts`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\queues\download-queue.ts`
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\repositories\prisma-library-repository.ts`

- [ ] **Step 1: Atualizar download-worker.ts**

Use a ferramenta `read_file` para ler o conteúdo de `download-worker.ts`.
Em seguida, use a ferramenta `replace` (ou reescreva o arquivo com `write_file` se for mais seguro) para:
1. Adicionar `import { logger } from '../utils/logger';` no topo.
2. Substituir todas as chamadas `console.log` por `logger.info` e `console.error` por `logger.error`.

- [ ] **Step 2: Atualizar product-state-service.ts**

Faça o mesmo para `product-state-service.ts`: adicione o import do logger e substitua os `console.log`/`error`.

- [ ] **Step 3: Atualizar download-queue.ts**

Faça o mesmo para `download-queue.ts`: adicione o import do logger e substitua os `console.log`/`error`.

- [ ] **Step 4: Atualizar prisma-library-repository.ts**

Faça o mesmo para `prisma-library-repository.ts`.

### Task 5: Limpeza de Código Legado (JSON Fallbacks) nos Repositórios

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\repositories\prisma-*.ts`

- [ ] **Step 1: Remover fallbacks JSON do Prisma Library Repository**

Use a ferramenta `read_file` em `C:\Users\cd250\Downloads\Projetos\CapDown\apps\api\src\repositories\prisma-library-repository.ts` para inspecionar os métodos.
Identifique qualquer comentário remanescente sobre "old state" ou lógica de fallback que leia de `app-state.json`.
Use `replace` para remover essas lógicas e comentários obsoletos, deixando o repositório focado apenas nas consultas limpas do Prisma.

### Task 6: Refatoração do Frontend (MangaDetail.jsx)

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\apps\client\src\pages\MangaDetail.jsx`

- [ ] **Step 1: Refatorar o estado usando useReducer**

Use `read_file` para ler `MangaDetail.jsx`. 
Reescreva a gestão de estado. Em vez de usar múltiplos `useState` isolados (`detail`, `error`, `loading`, `deleting`, `auditing`, `issues`, `preparingTg`, `coverErr`, `search`), crie um único estado agregado via `useReducer` ou múltiplos `useState` mas remova a necessidade de `// eslint-disable-next-line react-hooks/set-state-in-effect`.
Use a ferramenta `write_file` para salvar o componente reescrito de forma idiomática e limpa, garantindo que o alerta do linter seja resolvido nativamente (por exemplo, lidando com variáveis booleanas de forma segura no `useEffect` de carregamento).

### Task 7: Atualização do README Final

**Files:**
- Modify: `C:\Users\cd250\Downloads\Projetos\CapDown\README.md`

- [ ] **Step 1: Escrever novo README**

Use a ferramenta `write_file` para criar/sobrescrever o README.md na raiz com a estrutura final do projeto.

```markdown
# CapDown

Sistema de download, leitura e gerenciamento de mangás com armazenamento em nuvem via Telegram.

## Arquitetura Moderna (Monorepo)
- **Frontend**: React.js (Vite, TailwindCSS, Lucide Icons)
- **API**: Node.js (Fastify) + TypeScript + Prisma ORM (SQLite) + BullMQ (Redis)
- **Scraper**: Python (FastAPI) para extração limpa de dados
- **Storage**: Integração via MTProto (Telegram) como armazenamento em nuvem

## Estrutura do Monorepo
- `/apps/client` - Web UI e interface de leitura
- `/apps/api` - Backend Core, Filas de Download e Interação com DB
- `/apps/scraper` - Serviço isolado em Python para scraping

## Sobre a Limpeza e Refatoração
Este projeto foi completamente refatorado para abandonar os estados em JSON antigos e abraçar um fluxo de dados resiliente através do Prisma ORM e filas do BullMQ, garantindo tipagem estrita no backend e estabilidade no envio de dados para o Telegram.
```