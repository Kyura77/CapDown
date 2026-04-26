# Ralph Loop Harness Design

**Date:** 2026-04-25  
**Status:** Proposed  
**Assumption used in this spec:** "Ralph loop" aqui significa um harness de automação para desenvolvimento com agente, em que cada iteração roda com contexto fresco, lê especificação/plano do repositório, executa uma unidade de trabalho, grava estado/logs e reinicia no próximo ciclo.

---

## 1. Contexto

Hoje o repositório não tem nenhum artefato de Ralph loop:

- não existe pasta dedicada para prompts, estado ou logs do loop
- não existe runner no `package.json`
- não existe parser de plano/tarefas
- não existe contrato para plugar um agente externo sem acoplá-lo ao runtime do produto

O projeto já tem duas superfícies técnicas úteis para um harness desse tipo:

- raiz Node com `package.json`, usada hoje para orquestrar o projeto
- ambiente Windows/PowerShell ativo, que facilita wrapper local quando necessário

O harness de Ralph loop **não deve entrar** no backend Rust nem no frontend React. Ele deve viver como tooling de repositório.

## 2. Objetivo

Adicionar ao repositório uma infraestrutura mínima, explícita e auditável para rodar iterações de Ralph loop sobre specs e planos Markdown do próprio projeto, com:

- contexto fresco por iteração
- descoberta do próximo passo pendente do plano
- execução por comando externo configurável
- modo `dry-run`
- logs e estado persistidos em arquivos

## 3. Não-objetivos

Este trabalho **não** vai:

- integrar o Ralph loop ao runtime do CapDown
- reorganizar `apps/api` e `apps/client`
- depender rigidamente de um binário específico como `codex`, `claude` ou outro
- implementar swarm/multi-agent
- fazer auto-commit, porque o workspace atual não está em um repositório git inicializado

## 4. Abordagens consideradas

### Abordagem A — PowerShell puro

Usar só scripts `.ps1` para config, parser, logs e execução.

**Prós**
- combina com o ambiente Windows atual
- zero dependências extras

**Contras**
- parser e manipulação de arquivos ficam mais frágeis
- pior portabilidade
- manutenção mais difícil conforme o loop crescer

### Abordagem B — Node.js como núcleo + wrapper PowerShell

Implementar o loop em `Node.js` com módulos pequenos, e adicionar um wrapper `.ps1` apenas para conveniência local.

**Prós**
- combina com a raiz atual do projeto
- mais fácil de editar e testar
- cross-platform o suficiente
- separa lógica do loop de detalhes do shell

**Contras**
- adiciona uma pequena superfície nova de tooling

### Abordagem C — Ferramenta externa/CI apenas

Não versionar o harness no projeto; usar só tool externa.

**Prós**
- menos arquivos no repo

**Contras**
- pouca auditabilidade
- difícil de adaptar ao CapDown
- não resolve o pedido de “criar no projeto”

## 5. Recomendação

**Recomendo a Abordagem B.**

Ela cria um Ralph loop real no repositório, sem acoplar o runtime do produto a um orquestrador experimental. O loop fica editável em JavaScript, com wrapper PowerShell opcional, e usa um comando externo configurado por ambiente para evitar dependência dura de uma ferramenta específica.

## 6. Design proposto

### 6.1 Estrutura de arquivos

```text
automation/
  ralph-loop/
    config.example.json
    README.md
    prompts/
      system.md
      iteration.md
    state/
      .gitkeep
    logs/
      .gitkeep
scripts/
  ralph-loop/
    run.mjs
    lib/
      config.mjs
      plan-parser.mjs
      agent-command.mjs
      logging.mjs
      state-store.mjs
  ralph-loop.ps1
tests/
  ralph-loop/
    config.test.mjs
    plan-parser.test.mjs
    agent-command.test.mjs
```

### 6.2 Contrato do loop

Entrada mínima:

- `specPath`
- `planPath`
- `projectRoot`
- `agentCommandTemplate`
- `maxIterations`
- `dryRun`

Saída por iteração:

- arquivo de estado `tools/ralph-loop/state/current-run.json`
- log em `tools/ralph-loop/logs/<timestamp>-iteration-N.log`
- resumo da tarefa selecionada

### 6.3 Descoberta da próxima unidade

O loop vai procurar no plano:

- o primeiro `### Task N`
- dentro dele, o primeiro checkbox `- [ ]`

Essa linha vira a unidade de trabalho atual. O runner **não marca** a tarefa como concluída sozinho na primeira versão. Ele apenas constrói o prompt e registra que tentou aquela unidade.

### 6.4 Execução do agente

O harness não hardcode `codex` nem `claude`.

Ele usa:

- variável `CAPDOWN_RALPH_AGENT_CMD`, ou
- valor em `tools/ralph-loop/config.example.json` copiado para config local

O comando recebe um prompt montado com:

- spec
- plano
- tarefa atual
- resumo do estado da iteração anterior

### 6.5 Segurança operacional

Primeira versão deve incluir:

- `--dry-run`
- validação explícita de caminhos
- erro claro se não houver comando configurado
- erro claro se o plano não tiver checkbox pendente
- logs sem secrets do ambiente

## 7. Testes

O harness deve ter testes com `node:test` cobrindo:

- carga de config
- parsing do próximo checkbox pendente
- montagem do comando final sem shell injection acidental básica
- persistência de estado

## 8. Validação manual

Passos mínimos:

1. copiar `config.example.json` para config local
2. configurar um comando fake de agente
3. rodar `npm run ralph:dry-run`
4. verificar seleção correta da tarefa
5. verificar arquivo de estado
6. verificar log gerado

## 9. Critérios de sucesso

O Ralph loop será considerado “criado no projeto” quando:

- existir estrutura própria em `tools/ralph-loop`
- existir runner em `tools/ralph-loop/bin`
- existir script de execução no `package.json`
- o modo `dry-run` funcionar
- o runner conseguir descobrir a próxima etapa do plano e registrar a iteração
