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
- `/docs/plans` - Planos de implementação e histórico

## Sobre a Limpeza e Refatoração
Este projeto foi completamente refatorado para abandonar os estados em JSON antigos e abraçar um fluxo de dados resiliente através do Prisma ORM e filas do BullMQ, garantindo tipagem estrita no backend e estabilidade no envio de dados para o Telegram.
O frontend teve suas lógicas de UI simplificadas em hooks limpos e a documentação de auditoria movida corretamente para `docs/plans/`.
