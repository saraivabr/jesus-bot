const { GoogleGenerativeAI } = require('@google/generative-ai');

class BaseAgent {
  constructor(name, tradition, systemPrompt, config = {}) {
    this.name = name;
    this.tradition = tradition; // 'Christian', 'Greek', 'Stoic', 'Eastern', 'Modern'
    this.systemPrompt = systemPrompt;
    this.config = {
      primaryDomains: [],
      argumentStyle: 'rational',
      emotionalTone: 'balanced',
      conversationStyle: 'dialogue',
      strengths: [],
      traditionalAlliances: [],
      traditionalTensions: [],
      ...config
    };

    this.conversationHistory = new Map(); // userId -> messages[]
    this.userProfiles = new Map(); // userId -> profile data

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  // Gera resposta do agente
  async generateResponse(userMessage, context = {}) {
    const userId = context.userId || 'default';

    // Recupera ou cria histórico
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, []);
    }
    const history = this.conversationHistory.get(userId);

    // Recupera ou cria perfil do usuário
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {});
    }
    const profile = this.userProfiles.get(userId);

    // Limita histórico a 15 mensagens (7-8 turno de ida e volta)
    if (history.length > 15) {
      history.splice(0, history.length - 15);
    }

    // Monta contexto do perfil
    const profileContext = Object.keys(profile).length > 0
      ? `\n\n INFORMAÇÕES DO USUÁRIO:\n${Object.entries(profile).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
      : '';

    // Monta contexto de outras perspectivas (se disponível)
    let perspectiveContext = '';
    if (context.otherPerspectives && context.otherPerspectives.length > 0) {
      perspectiveContext = `\n\nOUTRAS PERSPECTIVAS JÁ APRESENTADAS:\n${context.otherPerspectives.map(p => `- ${p.agent}: "${p.perspective}"`).join('\n')}\n\nVocê pode concordar, discordar respeitosamente, ou trazer uma perspectiva complementar.`;
    }

    try {
      // Monta o prompt completo com instruções específicas do agente
      const fullPrompt = `${this.systemPrompt}${profileContext}${perspectiveContext}

ESTILO DE RESPOSTA:
- Seu estilo de argumento: ${this.config.argumentStyle}
- Tom emocional: ${this.config.emotionalTone}
- Estilo de conversa: ${this.config.conversationStyle}
- Você é particularmente forte em: ${this.config.strengths.join(', ')}

HISTÓRICO DA CONVERSA:
${history.map(h => `${h.role === 'user' ? 'Usuário' : this.name}: ${h.text}`).join('\n')}

Usuário: ${userMessage}

${this.name}:`;

      const result = await this.model.generateContent(fullPrompt);
      let response = result.response.text();

      // Corrige formatação WhatsApp
      response = response
        .replace(/\* /g, '*')
        .replace(/ \*/g, '*')
        .replace(/_ /g, '_')
        .replace(/ _/g, '_')
        .replace(/~ /g, '~')
        .replace(/ ~/g, '~');

      // Adiciona ao histórico
      history.push({ role: 'user', text: userMessage });
      history.push({ role: 'model', text: response });

      // Extrai informações do usuário
      this.extractUserInfo(userId, userMessage);

      return response;
    } catch (error) {
      console.error(`Erro ao gerar resposta de ${this.name}:`, error.message);
      return `${this.name} é momentaneamente silencioso, mas está ouvindo...`;
    }
  }

  // Extrai informações pessoais do usuário
  extractUserInfo(userId, message) {
    const profile = this.userProfiles.get(userId) || {};
    const msg = message.toLowerCase();

    // Detecta nome
    const nomeMatch = message.match(/(?:me chamo|meu nome é|sou|sou o|sou a|pode me chamar de)\s+([A-ZÀ-Ú][a-zà-ú]+)/i);
    if (nomeMatch) profile.nome = nomeMatch[1];

    // Detecta interesse/tema
    const temaMatches = message.match(/(?:gosto|amo|adoro|interessado|quero|preciso|tenho dúvida).*?(?:sobre|em|de|com)\s+([a-záàâãéèêíïóôõöúçñ\s]+?)(?:[\.\?!,]|$)/gi);
    if (temaMatches && temaMatches.length > 0) {
      profile.temas = (profile.temas || []).concat(temaMatches).slice(-5); // Últimos 5 temas
    }

    // Detecta dor/desafio
    if (msg.match(/sofr|dificil|problema|desafio|luto|perd|chorand|trist/)) {
      profile.emocao = 'procurando apoio';
    }

    // Detecta busca espiritual
    if (msg.match(/deus|sagrado|espirit|alma|fé|religião|transcend/)) {
      profile.busca = 'espiritual';
    }

    this.userProfiles.set(userId, profile);
  }

  // Determina se este agente deveria responder
  shouldRespond(userMessage, context = {}) {
    // Por padrão, sempre pode responder
    // Subclasses podem overrider para lógica mais específica
    return true;
  }

  // Retorna relevância (0-1) para esta mensagem
  getRelevance(userMessage, context = {}) {
    let relevance = 0.5; // Base padrão

    const msg = userMessage.toLowerCase();

    // Aumenta se menciona temas primários
    if (this.config.primaryDomains && this.config.primaryDomains.length > 0) {
      const domains = this.config.primaryDomains.join('|');
      if (msg.match(new RegExp(domains, 'i'))) {
        relevance = Math.min(1, relevance + 0.3);
      }
    }

    return relevance;
  }
}

module.exports = { BaseAgent };
