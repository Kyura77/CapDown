# Brainstorming: CapDown Scraper Explorer (Endpoint Mapper Agent)

## 1. Contexto do Problema
Sempre que queremos adicionar um site novo (como o Tomato para animes ou um novo site de mangá) ou quando um site atualiza sua API (como o Ego Toons que mudou para Next.js), sofremos para fazer a engenharia reversa. O desenvolvedor precisa abrir o DevTools, caçar requisições XHR, inspecionar ofuscação (AES, Base64) e testar endpoints manualmente.

O objetivo é criar um **Sub-Agente de Exploração Automática** (`CapDown Explorer`).
Uma ferramenta/script que entra num site, navega por ele, intercepta o tráfego e mapeia automaticamente como as APIs internas dele funcionam, gerando os adapters para nós.

## 2. Como o Agente Funcionaria?
A arquitetura do "Auto-Explorer" seria baseada em **Playwright (Headless Browser) + Network Interception + LLM**.

**Passo a Passo da Execução:**
1. **Navegação Guiada**: O desenvolvedor ou o script abre o site alvo (ex: `tomato.to/anime/123`).
2. **Interceptação de Rede**: O Playwright grava *todas* as requisições HTTP (`fetch`, `xhr`, `document`) em segundo plano, salvando Headers, Cookies, Request Body e Response Body.
3. **Filtro de Ruído**: Um script em Python limpa o lixo (imagens, CSS, fontes) e foca apenas em rotas que retornaram JSON, GraphQL ou manifestos de vídeo (`.m3u8`, `.mpd`).
4. **Análise via LLM**: O agente formata os dados capturados e envia para uma IA (ex: Claude/Gemini) com um prompt: *"Encontre qual dessas requisições retorna a lista de episódios ou a URL do vídeo MP4"*.
5. **Geração de Código Automática**: A IA cospe um arquivo `adapter_draft.py` pré-configurado com a URL correta, headers de autorização necessários e o esquema JSON de resposta.

## 3. Lidando com Proteções (Cloudflare e Criptografia)
- **Cloudflare/DDoS-Guard**: Usaremos a flag de `headless=False` ou plugins anti-detect (`undetected-playwright` / `FlareSolverr`) para passar pelo desafio do Cloudflare antes de começar a gravar o tráfego.
- **AES / Criptografia no Frontend**: Se a resposta da API for um texto criptografado (muito comum em sites de anime), o Playwright pode injetar um script no console da página (overriding `JSON.parse` ou funções do Web Crypto API) para "roubar" o dado logo após o próprio site descriptografar ele na memória.

## 4. Casos de Uso Práticos
- **TomatoDown (Animes)**: O agente entra na página de um episódio do Tomato, clica no botão "Play" sozinho, captura o request que pediu o stream de vídeo `.m3u8`, e nos entrega a rota exata, ignorando os anúncios.
- **EgoToons (Mangás)**: Como eles mudaram de WordPress para Next.js, o agente navegaria na página inicial, interceptaria as rotas ocultas do Next.js (`/_next/data/...`) e geraria o novo scraper pra nós em menos de 5 minutos, sem precisarmos caçar as URLs.

## 6. O Próximo Nível: O "Auto-Repair" Loop (Evolução Brutal)
O que diferencia esse agente de um mero interceptador de pacotes é a capacidade dele **se auto-consertar** se o site mudar.
- **Continuous Testing:** Em vez de usar apenas para criar novos sites, podemos usar o agente numa CI/CD ou no Cron do BullMQ.
- **Fluxo:** O CapDown tenta baixar do Verdinha e dá erro. O BullMQ aciona o "Auto-Explorer" invisível em modo headless. Ele acessa a página do Verdinha, intercepta o tráfego atualizado, passa pela IA, a IA gera um novo `adapter.py` e **substitui** o antigo código quebrado sem intervenção humana.
- **Alerta de Mutação:** Você acorda e vê no Telegram: *"⚠️ Scraper do Ego Toons quebrou hoje. Acionei o Auto-Explorer, ele descobriu a nova rota GraphQL, reescreveu o scraper e voltou a funcionar."*

## 7. Desofuscação Dinâmica via AST (Abstract Syntax Tree)
Quando o AES estiver embutido no arquivo `.js` (webpack chunks), o agente não tentará só "olhar" os requests.
Ele fará download dos scripts `.js`, passará eles por um parser AST (ex: `esprima` no JS) e pedirá pra IA: *"Encontre a chave AES ou a variável secreta de decriptação contida nesta árvore abstrata"*.
Isso eleva a performance de 80% para **99%**, derrotando até sites que criptografam a resposta e o Request Header juntos.

## 8. Sandboxing de JS e Simulação de Interação (Auto-Play)
Para sites de vídeo como o Tomato, o Playwright nem precisa de clique manual no modo de auto-repair.
Usaremos a biblioteca `langchain` ou as ferramentas nativas de clique do Claude/Gemini (Computer Use) para que a PRÓPRIA IA assuma o mouse, clique no botão Play do player pirata, feche o popup de propaganda (identificando visualmente), e extraia o arquivo `.m3u8` final. O humano não precisa mais nem dar o play inicial.
