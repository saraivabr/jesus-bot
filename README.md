# Jesus Bot - WhatsApp com IA

Bot conversacional para WhatsApp que utiliza inteligência artificial (Google Gemini) para conversar como Jesus Cristo de forma amorosa, sabia e acolhedora.

## Funcionalidades

### Conversacao Natural
- Responde como Jesus Cristo em primeira pessoa
- Conta historias da vida terrena de Jesus
- Usa parabolas e ensinamentos biblicos
- Adapta o tom conforme o momento (consolando, celebrando, orientando)

### Recursos Inteligentes
- **Devocional**: Compartilha meditacoes biblicas inspiradoras
- **Quiz Biblico**: Perguntas divertidas sobre a Biblia
- **Oracao**: Ora de forma personalizada pelos pedidos
- **Busca Biblica**: Explica passagens e versiculos
- **Plano de Leitura**: Sugere planos para ler a Biblia
- **Evangelismo**: Ajuda a preparar mensagens para compartilhar a fe
- **Indicacao**: Envia mensagem acolhedora para contatos compartilhados

### Comportamento Humanizado
- **Buffer de mensagens**: Espera 10 segundos para concatenar mensagens seguidas
- **Fragmentacao inteligente**: Divide respostas longas em ate 4 partes
- **Reacoes seletivas**: Reage com emojis baseado no conteudo (nao em toda mensagem)
- **Delay natural**: Simula digitacao com pausas realistas
- **Citacao**: Cita a mensagem que esta respondendo
- **Perfil do usuario**: Lembra informacoes como nome, profissao e momento de vida

### Formatacao WhatsApp
- *negrito* para verdades importantes
- _italico_ para palavras suaves
- ~riscado~ para coisas superadas

## Instalacao

### Pre-requisitos
- Node.js 18+
- Conta Google com acesso ao Gemini AI
- WhatsApp no celular

### Passos

1. Clone o repositorio:
```bash
git clone https://github.com/saraivabr/jesus-bot.git
cd jesus-bot
```

2. Instale as dependencias:
```bash
npm install
```

3. Configure a chave da API:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione sua chave do Gemini:
```
GEMINI_API_KEY=sua_chave_aqui
```

> Obtenha sua chave em: https://aistudio.google.com/apikey

4. Inicie o bot:
```bash
npm start
```

5. Escaneie o QR Code com o WhatsApp

## Uso

Apos conectar, qualquer pessoa que enviar mensagem para o numero conectado recebera uma resposta de "Jesus".

### Compartilhar Contatos
Quando voce compartilha um contato com o bot, ele automaticamente envia uma mensagem acolhedora para essa pessoa, se apresentando e oferecendo conversa.

### Conversacao
O bot mantem historico das conversas e lembra informacoes sobre cada usuario, criando uma experiencia personalizada.

## Estrutura do Projeto

```
jesus-bot/
├── start-bot.js      # Codigo principal do bot
├── package.json      # Dependencias
├── .env.example      # Exemplo de configuracao
├── .gitignore        # Arquivos ignorados
├── bot_sessions/     # Sessoes do WhatsApp (gerado automaticamente)
└── README.md         # Este arquivo
```

## Tecnologias

- **[Baileys](https://github.com/WhiskeySockets/Baileys)** - Biblioteca WhatsApp Web API
- **[Google Gemini AI](https://ai.google.dev/)** - Modelo de linguagem (gemini-2.0-flash)
- **[qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal)** - Exibicao do QR Code

## Configuracoes

| Variavel | Descricao | Padrao |
|----------|-----------|--------|
| `GEMINI_API_KEY` | Chave da API do Google Gemini | - |
| `BUFFER_DELAY` | Tempo de espera para concatenar mensagens (ms) | 10000 |

## Personalizacao

### Alterar o Prompt
O comportamento do bot e definido pela constante `JESUS_PROMPT` no arquivo `start-bot.js`. Voce pode editar para:
- Mudar a personalidade
- Adicionar novas capacidades
- Ajustar regras de resposta

### Alterar Fragmentacao
A funcao `fragmentMessage()` controla como as respostas sao divididas:
- Mensagens ate 200 chars: enviadas inteiras
- Mensagens maiores: divididas em ate 4 partes

### Alterar Reacoes
O objeto `REACTION_EMOJIS` define os emojis usados para reagir baseado em palavras-chave.

## Licenca

MIT

## Autor

Desenvolvido por [@saraivabr](https://github.com/saraivabr)

---

> "Vinde a mim, todos os que estais cansados e sobrecarregados, e eu vos aliviarei." - Mateus 11:28
