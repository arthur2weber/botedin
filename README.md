# Gerador de Posts para LinkedIn

Uma ferramenta que **escreve posts de LinkedIn com Inteligência Artificial**, **agenda** esses posts para publicarem sozinhos, e ainda **interage** (curte e responde) com os comentários dos seus posts.

Funciona para **qualquer área** — não é só para programadores. Se você é de Design, Produto, Qualidade (QA), Marketing ou qualquer outra área, basta ajustar um arquivo de configuração (explicado mais abaixo).

> **Você não precisa saber programar para usar.** Este guia explica tudo passo a passo. Você só vai copiar e colar alguns comandos no terminal e editar um arquivo de texto.

---

## Índice

1. [O que você vai precisar](#1-o-que-você-vai-precisar)
2. [Instalação (uma vez só)](#2-instalação-uma-vez-só)
3. [Configurar a chave da IA](#3-configurar-a-chave-da-ia)
4. [Fazer login no LinkedIn (uma vez só)](#4-fazer-login-no-linkedin-uma-vez-só)
5. [Personalizar para o SEU perfil](#5-personalizar-para-o-seu-perfil)
6. [Usando a ferramenta (comandos do dia a dia)](#6-usando-a-ferramenta-comandos-do-dia-a-dia)
7. [Entendendo o arquivo de configuração](#7-entendendo-o-arquivo-de-configuração-configjson)
8. [Exemplos de config para outras áreas](#8-exemplos-de-config-para-outras-áreas)
9. [Perguntas frequentes e problemas comuns](#9-perguntas-frequentes-e-problemas-comuns)
10. [Segurança e bom senso](#10-segurança-e-bom-senso)

---

## 1. O que você vai precisar

- **Um computador** com Windows, Mac ou Linux.
- **Node.js** instalado (versão 18 ou superior). É o programa que roda a ferramenta.
  - Para instalar: acesse [nodejs.org](https://nodejs.org), baixe a versão "LTS" e instale (next, next, finish).
  - Para conferir se já tem: abra o terminal e digite `node --version`. Se aparecer um número como `v18.0.0` ou maior, está ok.
- **Uma conta no LinkedIn** (a sua).
- **Uma chave de API do DeepSeek** (a IA que escreve os posts). Explicado no passo 3.

> **O que é "terminal"?** É um programa onde você digita comandos. No Windows, procure por "Prompt de Comando" ou "PowerShell". No Mac, procure por "Terminal". No Linux, você já conhece.

---

## 2. Instalação (uma vez só)

Abra o terminal **dentro da pasta do projeto** e rode os dois comandos abaixo, um de cada vez:

```bash
npm install
```

Isso baixa as peças que a ferramenta precisa. Pode demorar um pouco.

```bash
npx playwright install chromium
```

Isso baixa um navegador controlado pela ferramenta (ela usa esse navegador para acessar o LinkedIn por você).

> Você só precisa fazer isso **uma vez**.

---

## 3. Configurar a chave da IA

A ferramenta usa o **DeepSeek** (uma IA) para escrever os posts. Você precisa de uma "chave" (uma senha especial da API).

1. Crie uma conta em [platform.deepseek.com](https://platform.deepseek.com).
2. Gere uma chave de API (procure por "API Keys").
3. Na pasta do projeto, crie um arquivo chamado **`.env`** (com o ponto no começo) e coloque dentro:

```
DEEPSEEK_API_KEY=cole-sua-chave-aqui
```

> **Importante:** esse arquivo guarda uma senha. Não compartilhe com ninguém e não suba para a internet. (A ferramenta já está configurada para ignorá-lo.)

---

## 4. Fazer login no LinkedIn (uma vez só)

A ferramenta precisa estar logada na sua conta para postar e interagir. Rode:

```bash
npm run authenticate
```

Vai abrir uma janela de navegador na tela de login do LinkedIn.

1. Faça login normalmente (digite seu email e senha do LinkedIn).
   - **Dica:** use email e senha direto, evite o botão "Entrar com Google".
2. Quando você chegar na sua página inicial (feed), a ferramenta **salva a sessão sozinha e fecha o navegador**.

Pronto. A partir de agora ela fica logada. Você só precisa repetir isso se a sessão expirar (de vez em quando).

---

## 5. Personalizar para o SEU perfil

Toda a personalização fica em **um único arquivo: `config.json`**. É um arquivo de texto que você abre em qualquer editor (Bloco de Notas serve).

**Primeiro, crie o seu `config.json` a partir do modelo:**

```bash
cp config.example.json config.json
```

(No Windows, se o `cp` não funcionar, use `copy config.example.json config.json`.)

A forma mais fácil de começar é deixar a ferramenta ler o seu perfil do LinkedIn automaticamente:

1. Abra o `config.json` e troque o valor de `perfilUrl` pela URL do **seu** perfil do LinkedIn. Exemplo:

```json
"perfilUrl": "https://www.linkedin.com/in/seu-usuario/",
```

2. Rode:

```bash
node profile.js
```

Isso abre seu perfil, extrai um resumo (sua headline, o "Sobre", suas skills) e salva dentro do `config.json`. A IA passa a usar isso para escrever posts com a sua cara.

3. Depois, ajuste os outros campos do `config.json` conforme a [seção 7](#7-entendendo-o-arquivo-de-configuração-configjson).

> Se a extração automática não pegar tudo, não tem problema: você pode editar o campo `perfil.resumo` do `config.json` à mão.

---

## 6. Usando a ferramenta (comandos do dia a dia)

> **Dica de segurança:** quase todos os comandos começam em "modo de teste" (chamado `DRY_RUN`). Nesse modo, a ferramenta mostra o que faria **sem publicar nada de verdade**. Para valer, você adiciona `DRY_RUN=false` na frente do comando.

### Ver um post de exemplo (sem publicar)

```bash
node generate.js
```

Escreve um post sobre um tema aleatório da sua lista e mostra na tela. Não publica. Bom para ver se o estilo está do seu agrado.

Para um tema específico:

```bash
node generate.js "como dar feedback para o time de design"
```

### Publicar um post agora

```bash
# Modo de teste: escreve e mostra no navegador, mas NÃO publica
npm start

# De verdade: escreve e PUBLICA agora
npm run publish
```

### Agendar vários posts de uma vez (o mais útil)

Isso gera vários posts e agenda todos para publicarem sozinhos no futuro, usando o agendamento nativo do LinkedIn (você nem precisa estar com o computador ligado na hora).

```bash
# Modo de teste: mostra os textos e as datas, sem agendar
DRY_RUN=true node batch-schedule.js 8

# De verdade: agenda 8 posts
DRY_RUN=false node batch-schedule.js 8

# Agendar bastante (até o limite de ~3 meses do LinkedIn)
DRY_RUN=false node batch-schedule.js 40
```

O número no final (`8`, `40`) é **quantos posts** você quer agendar. As datas e horários seguem o que estiver em `agendamento` no `config.json` (por padrão: segunda, terça, quinta e sexta às 09:00).

> **Limite:** o LinkedIn só deixa agendar até cerca de 3 meses à frente. Se você pedir mais do que cabe, a ferramenta avisa e agenda só o que é possível.

Para **continuar de onde parou** (sem repetir datas já agendadas), informe a data de início:

```bash
START_DATE=2026-11-01 DRY_RUN=false node batch-schedule.js 20
```

Para **ver os posts agendados**: no LinkedIn, clique em "Começar publicação", depois no ícone de **relógio**, e em "Ver publicações agendadas".

### Interagir com os comentários dos seus posts

Curte e responde (com comentários prontos) os comentários que as pessoas deixam nos seus posts.

```bash
# Modo de teste: mostra o que faria, sem clicar em nada
node interact.js

# Só CURTIR os comentários (não responde publicamente)
DRY_RUN=false SKIP_REPLY=true node interact.js

# Curtir E responder de verdade
DRY_RUN=false node interact.js
```

### Ver exemplos de comentários prontos

```bash
node comments.js 6          # mostra 6 comentários de exemplo
node comments.js 6 --short  # versão curta (só o elogio inicial)
```

### Atualizar o resumo do seu perfil

```bash
node profile.js          # extrai de novo do LinkedIn
node profile.js --show   # mostra o que está salvo
```

---

## 7. Entendendo o arquivo de configuração (`config.json`)

Este é **o único arquivo que você precisa editar**. Abra em um editor de texto. Abaixo, o que cada parte faz:

### `perfilUrl`
A URL do seu perfil do LinkedIn. Usada para extrair seu perfil e para encontrar seus posts.

### `autor` — quem você é
```json
"autor": {
  "senioridade": "sênior",
  "papel": "Engenheiro de Software",
  "especialidades": ["PHP", "Laravel", "arquitetura"]
}
```
- `senioridade`: júnior, pleno, sênior, especialista, líder...
- `papel`: seu cargo/função (ex: "Product Manager", "UX Designer", "Analista de QA").
- `especialidades`: suas áreas de domínio.

### `estilo` — como os posts soam
```json
"estilo": {
  "idioma": "português do Brasil",
  "tom": "técnico e didático",
  "tamanhoAlvoPalavras": 180,
  "emojis": "moderado",
  "hashtags": true,
  "quantidadeHashtags": 4,
  "chamadaParaInteracao": true,
  "revisarHumanizar": false,
  "tipoDiscussao": "discussão técnica",
  "focoEspecificidade": "Seja específico e técnico quando o tema permitir."
}
```
- `idioma`: `"português do Brasil"` ou `"English"`, por exemplo.
- `tom`: ex: "técnico e didático", "estratégico", "criativo e inspirador".
- `tamanhoAlvoPalavras`: tamanho alvo do post.
- `emojis`: `"nenhum"`, `"moderado"` ou `"muitos"`.
- `hashtags` / `quantidadeHashtags`: se inclui hashtags e quantas.
- `chamadaParaInteracao`: se termina com uma pergunta para gerar comentários.
- `revisarHumanizar`: se `true`, faz um passo extra de revisão para o texto soar mais humano (gasta um pouco mais de IA). Pode deixar `false`.
- **`tipoDiscussao`**: o tipo de conversa que a pergunta final estimula. Ex: `"discussão técnica"`, `"discussão sobre produto"`, `"troca sobre experiências de design"`. **Importante para áreas não-técnicas.**
- **`focoEspecificidade`**: a instrução de "ser específico" na sua área. **Mude isso se você NÃO é de tecnologia** (veja exemplos na seção 8).

### `temas` — sobre o que postar
Uma lista de assuntos. Quando você não passa um tema específico, a ferramenta escolhe um daqui. Coloque temas da **sua** área.

### `agendamento` — quando publicar
```json
"agendamento": {
  "horaDoDia": 9,
  "minuto": 0,
  "diasDaSemana": [1, 2, 4, 5],
  "postsPorDia": 1
}
```
- `horaDoDia` / `minuto`: horário (formato 24h). `9` e `0` = 09:00.
- `diasDaSemana`: quais dias publicar. **0 = domingo, 1 = segunda, ... 6 = sábado.** O exemplo `[1,2,4,5]` = segunda, terça, quinta e sexta (4 posts por semana).
- `postsPorDia`: quantos posts por dia de publicação.

### `interacoes` — limites ao curtir/responder
- `maxComentariosPorExecucao`: no máximo quantos comentários tratar por vez (evita exagero).
- `comentarioComCorpo`: se `true`, as respostas são completas; se `false`, só um elogio curto.

### `comentarios` — frases prontas para responder
As frases usadas quando a ferramenta responde comentários. São montadas combinando uma `abertura` (elogio) + `contexto` + `impacto` + `pergunta`. Edite para a sua área (veja exemplos na seção 8).

### `ia` — configuração da Inteligência Artificial
Modelo e criatividade. Normalmente você **não precisa mexer** aqui.

### `perfil` — seu resumo (preenchido automaticamente)
Preenchido pelo comando `node profile.js`. Você pode editar o campo `resumo` à mão se quiser.

---

## 8. Exemplos de config para outras áreas

A ferramenta serve para qualquer profissão. Veja o que mudar no `config.json` para três exemplos.

### Exemplo: Product Manager (Produto)
```json
"autor": {
  "senioridade": "sênior",
  "papel": "Product Manager",
  "especialidades": ["discovery", "métricas de produto", "priorização", "pesquisa com usuários"]
},
"estilo": {
  "tom": "estratégico e acessível",
  "tipoDiscussao": "discussão sobre produto e descoberta de usuário",
  "focoEspecificidade": "Seja específico sobre decisões de produto, métricas de negócio e impacto no usuário, sem jargão técnico de engenharia."
},
"temas": [
  "como priorizar o backlog quando tudo parece urgente",
  "métricas de ativação e retenção que realmente importam",
  "como conduzir discovery contínuo com pouco tempo",
  "dizer não para stakeholders sem queimar a relação"
]
```

### Exemplo: UX/Product Designer
```json
"autor": {
  "senioridade": "pleno",
  "papel": "Product Designer",
  "especialidades": ["UX research", "design system", "acessibilidade", "prototipação"]
},
"estilo": {
  "tom": "criativo e reflexivo",
  "tipoDiscussao": "troca de experiências sobre design e UX",
  "focoEspecificidade": "Seja específico sobre decisões de design, pesquisa com usuários e impacto na experiência, evitando jargão técnico de código."
},
"temas": [
  "como defender uma decisão de design com dados",
  "quando o design system atrapalha em vez de ajudar",
  "acessibilidade não é opcional: por onde começar",
  "pesquisa com usuário em projetos com prazo apertado"
]
```

### Exemplo: Analista de Qualidade (QA)
```json
"autor": {
  "senioridade": "pleno",
  "papel": "Analista de Qualidade (QA)",
  "especialidades": ["testes automatizados", "QA manual", "qualidade de processo", "cultura de qualidade"]
},
"estilo": {
  "tom": "prático e colaborativo",
  "tipoDiscussao": "troca sobre práticas de qualidade e testes",
  "focoEspecificidade": "Seja específico sobre estratégias de teste, prevenção de defeitos e qualidade de processo."
},
"temas": [
  "qualidade é responsabilidade do time todo, não só do QA",
  "quando automatizar um teste e quando não vale a pena",
  "como escrever um bom relatório de bug",
  "testes que passam mas não garantem nada"
]
```

> Para os `comentarios` (frases de resposta), troque as frases em inglês sobre engenharia por frases da sua área. A estrutura é: um elogio de abertura, um contexto, um impacto e uma pergunta final.

---

## 9. Perguntas frequentes e problemas comuns

**"Deu erro dizendo que a chave da IA não foi encontrada."**
Confira se o arquivo `.env` existe na pasta do projeto e tem a linha `DEEPSEEK_API_KEY=...` com a sua chave.

**"Abriu o navegador mas pediu login de novo."**
A sessão expirou. Rode `npm run authenticate` de novo.

**"O navegador diz que não é seguro / pede verificação."**
Isso acontece às vezes com login automatizado. Faça o login com calma, resolva qualquer verificação na tela, e evite "Entrar com Google".

**"Pedi para agendar muitos posts e alguns não entraram."**
O LinkedIn só permite agendar até ~3 meses. Além disso, de vez em quando um agendamento falha por lentidão — a ferramenta pula e continua. Rode de novo com `START_DATE` na data que ficou vazia.

**"Como vejo o que foi agendado?"**
No LinkedIn: "Começar publicação" → ícone de relógio → "Ver publicações agendadas".

**"Os posts estão com cara de robô / genéricos."**
Rode `node profile.js` para a IA usar o seu perfil real, e deixe os `temas` do `config.json` bem específicos (quanto mais específico o tema, melhor o post).

**"Posso usar em português e inglês?"**
Sim. Mude `estilo.idioma` no `config.json`.

---

## 10. Segurança e bom senso

- **Nada é publicado por engano.** Tudo começa em modo de teste. Só publica/agenda quando você usa `DRY_RUN=false`.
- **Use com moderação na interação.** Curtir e responder muita coisa muito rápido pode fazer o LinkedIn achar que você é um robô. A ferramenta já coloca pausas e limites, mas evite rodar a interação muitas vezes seguidas.
- **Revise os posts agendados.** A IA é boa, mas dê uma olhada no que foi agendado (dá para editar ou apagar direto no LinkedIn).
- **Guarde sua chave da IA e seu `.env` em segredo.**

---

## Resumo dos comandos

| Comando | O que faz |
|---|---|
| `npm run authenticate` | Faz login no LinkedIn (uma vez). |
| `node profile.js` | Extrai seu perfil para a IA usar como contexto. |
| `node generate.js` | Mostra um post de exemplo (não publica). |
| `npm start` | Escreve e mostra no navegador, sem publicar. |
| `npm run publish` | Escreve e publica agora. |
| `DRY_RUN=false node batch-schedule.js 8` | Agenda 8 posts. |
| `node interact.js` | Mostra o que faria com os comentários (teste). |
| `DRY_RUN=false node interact.js` | Curte e responde comentários de verdade. |
| `node comments.js 6` | Mostra 6 comentários de exemplo. |

Toda a personalização está no arquivo **`config.json`**.
