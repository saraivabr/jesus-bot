const { AgentFactory } = require('../agents/agentFactory');
const { IntentDetector } = require('./intentDetector');

class Orchestrator {
  constructor() {
    this.agentFactory = new AgentFactory();
    this.intentDetector = new IntentDetector();
    this.conversations = new Map(); // userId -> conversation state
    this.messageBuffer = new Map(); // userId -> {texts, timer, originalMsg}
    this.BUFFER_DELAY = 4000; // 4 segundos para acumular msgs
  }

  // Inicializa conversação para um usuário
  initializeConversation(userId) {
    if (!this.conversations.has(userId)) {
      this.conversations.set(userId, {
        userId,
        messages: [],
        activeAgents: [],
        lastAgent: null,
        context: {},
        createdAt: new Date(),
        messageCount: 0
      });
    }
    return this.conversations.get(userId);
  }

  // Processa mensagem do usuário
  async processMessage(userMessage, userId) {
    // Inicializa conversação se não existe
    const conversation = this.initializeConversation(userId);
    conversation.messageCount++;

    // Analisa intenção
    const analysis = this.intentDetector.analyze(userMessage);

    // Seleciona agentes apropriados
    const agents = this.selectAgents(analysis, conversation);

    // Gera respostas dos agentes
    const responses = await this.generateResponses(userMessage, agents, conversation, analysis);

    // Atualiza histórico da conversa
    conversation.messages.push({
      role: 'user',
      text: userMessage,
      analysis,
      timestamp: new Date()
    });

    responses.forEach(r => {
      conversation.messages.push({
        role: 'agent',
        agent: r.agent,
        text: r.response,
        timestamp: new Date()
      });
    });

    conversation.activeAgents = agents.map(a => a.name);
    conversation.lastAgent = agents[0]?.name;

    return responses;
  }

  // Seleciona quais agentes devem responder
  selectAgents(analysis, conversation) {
    const suggestions = this.intentDetector.suggestAgents(analysis, this.agentFactory);

    if (suggestions.length > 0) {
      // Use sugestões do intent detector
      return suggestions.map(s => this.agentFactory.getAgent(s.agent)).filter(a => a);
    }

    // Fallback: seleciona baseado em relevância geral
    const allAgents = this.agentFactory.getAllAgents();
    const scored = allAgents.map(agent => ({
      agent,
      relevance: agent.getRelevance(analysis.message, { analysis })
    }));

    return scored
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 2)
      .map(s => s.agent);
  }

  // Gera respostas de múltiplos agentes
  async generateResponses(userMessage, agents, conversation, analysis) {
    const responses = [];
    const context = {
      userId: conversation.userId,
      analysis,
      otherPerspectives: []
    };

    for (const agent of agents) {
      try {
        const response = await agent.generateResponse(userMessage, context);

        responses.push({
          agent: agent.name,
          tradition: agent.tradition,
          response,
          style: agent.config.argumentStyle
        });

        // Adiciona às perspectivas para próximos agentes
        context.otherPerspectives.push({
          agent: agent.name,
          perspective: response.substring(0, 150) // Primeiros 150 chars
        });
      } catch (error) {
        console.error(`Erro ao gerar resposta de ${agent.name}:`, error.message);
      }
    }

    return responses;
  }

  // Formata respostas para WhatsApp (agrupa agentes por tradição)
  formatWhatsAppResponses(responses) {
    if (responses.length === 0) return [];

    if (responses.length === 1) {
      const r = responses[0];
      return [{
        text: `*${r.agent}* 💭\n\n${r.response}`,
        agent: r.agent
      }];
    }

    // Múltiplos agentes - agrupa por tradição
    const byTradition = {};
    responses.forEach(r => {
      if (!byTradition[r.tradition]) byTradition[r.tradition] = [];
      byTradition[r.tradition].push(r);
    });

    const formatted = [];
    for (const [tradition, agents] of Object.entries(byTradition)) {
      const agentNames = agents.map(a => `*${a.agent}*`).join(' e ');
      const responses_text = agents.map(a => `_${a.agent}_: ${a.response.substring(0, 100)}...`).join('\n\n');

      formatted.push({
        text: `${agentNames} (${tradition})\n\n${responses_text}`,
        tradition
      });
    }

    return formatted;
  }

  // Fragmenta mensagem para WhatsApp (máx 4 partes)
  fragmentMessage(text) {
    const paragraphs = text.split(/\n\n+|\n/).filter(p => p.trim());

    if (paragraphs.length >= 2) {
      if (paragraphs.length > 4) {
        const result = [];
        const perPart = Math.ceil(paragraphs.length / 4);
        for (let i = 0; i < paragraphs.length; i += perPart) {
          result.push(paragraphs.slice(i, i + perPart).join('\n'));
        }
        return result.slice(0, 4);
      }
      return paragraphs;
    }

    if (text.length > 150) {
      const parts = [];
      let remaining = text;
      while (remaining.length > 100 && parts.length < 3) {
        const match = remaining.match(/^(.{80,180}?[.!?])\s+/);
        if (match) {
          parts.push(match[1].trim());
          remaining = remaining.substring(match[0].length).trim();
        } else {
          break;
        }
      }
      if (remaining) parts.push(remaining);
      if (parts.length > 1) return parts;
    }

    return [text];
  }

  // Retorna estatísticas da conversa
  getConversationStats(userId) {
    const conversation = this.conversations.get(userId);
    if (!conversation) return null;

    return {
      userId,
      messageCount: conversation.messageCount,
      activeAgents: conversation.activeAgents,
      duration: new Date() - conversation.createdAt,
      traditions: [...new Set(conversation.messages
        .filter(m => m.agent)
        .map(m => this.agentFactory.getAgent(m.agent)?.tradition)
        .filter(Boolean)
      )]
    };
  }

  // Retorna info do orchestrador
  getStatus() {
    return {
      totalAgents: this.agentFactory.agents.size,
      agents: Array.from(this.agentFactory.agents.keys()),
      activeConversations: this.conversations.size,
      traditions: Array.from(this.agentFactory.agentsByTradition.keys())
    };
  }
}

module.exports = { Orchestrator };
