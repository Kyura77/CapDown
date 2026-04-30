# 01 — VERDADE CRUA

## O que está bom

- Ideia central (Telegram como CDN) é real e inteligente.
- Semáforo + backoff no worker funcionam.
- Zod contracts compartilhados é boa arquitetura.
- BullMQ é escolha certa para a carga.
- 3 providers Python funcionais.

## O que está iludido

- **"Backend Rust/Axum"**: É Node.js/Fastify. Zero Rust. Documentação mente sobre a stack.
- **Plano de agente explorador**: Seções 3, 7, 8 descrevem bypass de proteções técnicas (Cloudflare, AES em memória). Isso é risco legal, não feature.
- **Auto-repair loop**: Promete que o sistema se autoconserta. Não existe nenhum test de contrato no projeto. Autoconserto sem testes = trocar um bug por outro.
- **16 tasks do plano Telegram**: Tasks 12-16 são projetos diferentes embutidos num brainstorm. TomatoDown com MTProto é outra stack, outro projeto.
- **PLANO_DE_IMPLEMENTACAO.md, PLANO_FASE_4.md, RALPH_LOOP_PLAN.md**: Arquivos deletados do root mas copiados para `docs/plans/`. Projetos dentro de projetos. Complexidade sem foco.

## O que vai quebrar primeiro

1. **Redis offline** → downloads param silenciosamente. Usuário não sabe.
2. **Rate limit Telegram** → ban do bot sem `Retry-After`. Toda a biblioteca fica inacessível.
3. **URL Telegram expira** → leitura pausada volta com imagens quebradas.
4. **Provider muda layout** → scraper retorna HTML de erro silenciosamente. Usuário baixa capítulo corrompido.
5. **`dev-key-123`** como API Key default → se exposto à internet, acesso total.

## O que precisa ser feito ANTES de inventar mais feature

1. Tirar `dev.db` e `.env` do git. Agora.
2. API Key sem fallback inseguro em produção.
3. Fallback para fila sem Redis.
4. Referer dinâmico por provider (1 linha por provider).
5. Testes de contrato para os 3 providers.
6. Health check real.

Só depois disso: novas features.

## Decisão: continuar, cortar ou reestruturar?

**Continuar — mas com cortes cirúrgicos.**

A base existe e funciona para uso pessoal. A arquitetura não está errada, está incompleta e insegura em pontos específicos. Não precisa reescrever. Precisa de:

1. Limpeza de segurança (Sprint 0, 1 semana).
2. Testes de contrato (Sprint 1, 2 semanas).
3. Depois, features novas em cima de base testada.

O que cortar definitivamente: bypass de Cloudflare/AES do plano do agente. O que adiar: Anilist, TomatoDown, Kids Filter, Canonical Graph completo.
