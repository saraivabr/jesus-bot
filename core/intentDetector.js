// Detecta intenção e temas na mensagem do usuário
class IntentDetector {
  constructor() {
    this.themes = {
      love: {
        keywords: ['amor', 'amar', 'quero', 'amado', 'carinho', 'afeto', 'paixão'],
        domains: ['love', 'relationships', 'meaning']
      },
      wisdom: {
        keywords: ['sábio', 'sabedoria', 'verdade', 'conhecimento', 'aprend', 'entend'],
        domains: ['wisdom', 'knowledge', 'truth']
      },
      faith: {
        keywords: ['fé', 'deus', 'sagrado', 'espirit', 'religião', 'acredit', 'divino'],
        domains: ['faith', 'spirituality', 'meaning']
      },
      suffering: {
        keywords: ['sofr', 'dor', 'difícil', 'problema', 'desafio', 'medo', 'ansied'],
        domains: ['suffering', 'pain', 'struggle']
      },
      joy: {
        keywords: ['alegr', 'feliz', 'felicidad', 'alegria', 'sucesso', 'conquista', 'vitoria'],
        domains: ['joy', 'success', 'celebration']
      },
      justice: {
        keywords: ['justiça', 'injustiça', 'direito', 'certo', 'errado', 'moral', 'ética'],
        domains: ['justice', 'virtue', 'morality']
      },
      virtue: {
        keywords: ['virtude', 'caráter', 'honra', 'integridade', 'coragem', 'temperança'],
        domains: ['virtue', 'excellence', 'character']
      },
      peace: {
        keywords: ['paz', 'tranquilid', 'calma', 'sereno', 'quieto', 'repouso', 'harmonia'],
        domains: ['peace', 'tranquility', 'acceptance']
      },
      power: {
        keywords: ['poder', 'força', 'controle', 'dominio', 'influência', 'autoridade'],
        domains: ['power', 'freedom', 'control']
      }
    };

    this.queryTypes = {
      question: /\?$|^(como|o que|por que|quando|onde|qual|quem|poderia)/i,
      statement: /\.$|^(acho que|acredito|tenho certeza|é verdade)/i,
      prayer: /^(pai|senhor|deus|jesus|oração|reza|pede)/i,
      devotional: /^(devocional|reflexão|meditação|palavra do dia)/i,
      biblical: /^(bíblia|versículo|evangelho|salmo|escritura)/i,
      crisis: /suicídio|matar|morte|desespero|fim/i
    };
  }

  // Detecta o tipo de consulta
  detectQueryType(message) {
    const msg = message.toLowerCase();
    for (const [type, regex] of Object.entries(this.queryTypes)) {
      if (msg.match(regex)) {
        return type;
      }
    }
    return 'general';
  }

  // Detecta temas na mensagem
  detectThemes(message) {
    const msg = message.toLowerCase();
    const detected = [];

    for (const [themeName, themeData] of Object.entries(this.themes)) {
      const hasKeywords = themeData.keywords.some(kw => msg.includes(kw));
      if (hasKeywords) {
        detected.push({
          theme: themeName,
          domains: themeData.domains,
          strength: themeData.keywords.filter(kw => msg.includes(kw)).length
        });
      }
    }

    // Ordena por força de detecção
    return detected.sort((a, b) => b.strength - a.strength);
  }

  // Detecta contexto e emoção
  detectEmotion(message) {
    const msg = message.toLowerCase();

    if (msg.match(/feliz|alegr|maravilh|incrível|adorei|melhor/)) return 'positive';
    if (msg.match(/triste|chorand|difícil|sofr|dor|luto|perdi/)) return 'negative';
    if (msg.match(/confus|dúvida|não sei|incert|indecis/)) return 'uncertain';
    if (msg.match(/raiva|ódio|fúria|irritad|revolta/)) return 'angry';
    if (msg.match(/medo|pavor|assust|ansied|pânic/)) return 'fearful';

    return 'neutral';
  }

  // Retorna análise completa da mensagem
  analyze(message) {
    const queryType = this.detectQueryType(message);
    const themes = this.detectThemes(message);
    const emotion = this.detectEmotion(message);

    return {
      message,
      queryType,
      themes,
      primaryTheme: themes.length > 0 ? themes[0].theme : null,
      domains: [...new Set(themes.flatMap(t => t.domains))],
      emotion,
      timestamp: new Date()
    };
  }

  // Sugere agentes baseado na análise
  suggestAgents(analysis, agentFactory) {
    const suggestions = [];

    if (!agentFactory || !agentFactory.getAllAgents) {
      return suggestions;
    }

    const agents = agentFactory.getAllAgents();

    // Encontra agentes que combinam com os domínios detectados
    for (const agent of agents) {
      let score = 0;

      // Combina com domínios primários
      if (agent.config.primaryDomains) {
        const matchedDomains = agent.config.primaryDomains.filter(d =>
          analysis.domains.includes(d)
        );
        score += matchedDomains.length * 2;
      }

      // Combina com tom emocional
      if (agent.config.emotionalTone &&
          (analysis.emotion === 'negative' && agent.config.emotionalTone.includes('compassionate'))) {
        score += 1;
      }

      if (score > 0) {
        suggestions.push({
          agent: agent.name,
          tradition: agent.tradition,
          score,
          reason: analysis.domains
        });
      }
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
}

module.exports = { IntentDetector };
