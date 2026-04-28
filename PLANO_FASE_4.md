# Plano de Implementação: Fase 4 - Telegram & Provedores Madara

Este plano descreve a finalização do sistema de downloads com integração real ao Telegram e expansão de provedores.

## 1. Integração Real com Telegram
**Objetivo:** Substituir o mock local por uploads reais para o Telegram.

- **[NOVO] `apps/api/src/services/telegram-bot.ts`**: Criar serviço para interagir com a API do Telegram (`sendPhoto`).
- **[MODIFICAR] `apps/api/src/services/download-worker.ts`**: Alterar para fazer upload das páginas baixadas para o Telegram e obter o `file_id`.
- **[MODIFICAR] `apps/api/src/repositories/prisma-library-repository.ts`**: Garantir que o banco armazene o `file_id` do Telegram para cada página.
- **[MODIFICAR] `apps/api/src/routes/library.ts`**: Ajustar rotas de visualização de imagem para usar o Telegram.

## 2. Expansão de Provedores (Template Madara)
**Objetivo:** Implementar um scraper genérico para sites que usam o tema Madara.

- **[NOVO] `apps/scraper/providers/madara.py`**: Criar classe base `MadaraProvider` no Python Scraper.
- **[MODIFICAR] `apps/scraper/main.py`**: Adicionar suporte a provedores como **Capitoons** ou **Ego Toons** usando a classe base Madara.
- **[MODIFICAR] `apps/api/src/providers/index.ts`**: Habilitar os novos provedores no backend Node.

## 3. Ajustes Android & CI/CD
**Objetivo:** Melhorar a segurança e automação.

- **[MODIFICAR] `apps/client/src/api/runtime.js`**: Remover IPs fixos e usar variáveis de ambiente dinâmicas.
- **[NOVO] `.github/workflows/verify.yml`**: Adicionar pipeline básico de lint e typecheck.

---

### Perguntas Abertas
1. Qual provedor da sua lista (Capitoons, Ego Toons, etc) você quer que eu use para testar o template Madara primeiro?
2. Você tem o Token do Bot do Telegram em mãos ou quer que eu deixe o campo pronto nas configurações para você inserir?
