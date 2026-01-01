const fs = require('fs');
const path = require('path');
const { BaseAgent } = require('./baseAgent');

class AgentFactory {
  constructor() {
    this.agents = new Map(); // name -> agent instance
    this.agentsByTradition = new Map(); // tradition -> [agents]
    this.loadAgents();
  }

  // Carrega todos os agentes da estrutura de pastas
  loadAgents() {
    const agentsDir = __dirname;
    const traditions = ['christian', 'greek', 'stoic', 'eastern', 'modern'];

    for (const tradition of traditions) {
      const traditionDir = path.join(agentsDir, tradition);
      if (!fs.existsSync(traditionDir)) continue;

      const files = fs.readdirSync(traditionDir).filter(f => f.endsWith('.js'));

      for (const file of files) {
        try {
          const agentModule = require(path.join(traditionDir, file));
          const AgentClass = Object.values(agentModule)[0];

          if (AgentClass && AgentClass.prototype instanceof BaseAgent) {
            const agent = new AgentClass();
            this.agents.set(agent.name, agent);

            // Organiza por tradição
            if (!this.agentsByTradition.has(tradition)) {
              this.agentsByTradition.set(tradition, []);
            }
            this.agentsByTradition.get(tradition).push(agent);

            console.log(`✅ Agente carregado: ${agent.name} (${tradition})`);
          }
        } catch (error) {
          console.error(`❌ Erro ao carregar ${file}:`, error.message);
        }
      }
    }

    console.log(`\n🤖 Total de ${this.agents.size} agentes carregados`);
  }

  // Retorna um agente por nome
  getAgent(name) {
    return this.agents.get(name);
  }

  // Retorna todos os agentes
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  // Retorna agentes de uma tradição
  getAgentsByTradition(tradition) {
    return this.agentsByTradition.get(tradition) || [];
  }

  // Seleciona melhor agente para uma mensagem (baseado em relevância)
  selectBestAgent(userMessage, context = {}) {
    const agents = this.getAllAgents();
    let bestAgent = null;
    let bestRelevance = 0;

    for (const agent of agents) {
      const relevance = agent.getRelevance(userMessage, context);
      if (relevance > bestRelevance) {
        bestRelevance = relevance;
        bestAgent = agent;
      }
    }

    return bestAgent || agents[0]; // Retorna primeiro se nenhum selecionado
  }

  // Seleciona múltiplos agentes para debate
  selectAgentsForDebate(userMessage, context = {}, count = 3) {
    const agents = this.getAllAgents();
    const scored = agents.map(agent => ({
      agent,
      relevance: agent.getRelevance(userMessage, context)
    }));

    // Ordena por relevância e pega os top N
    return scored
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, count)
      .map(s => s.agent);
  }

  // Seleciona agente de tradição diferente para perspectiva alternativa
  selectAlternativePerspective(userMessage, context = {}, excludeTradition = null) {
    const agents = this.getAllAgents()
      .filter(a => a.tradition !== excludeTradition);

    if (agents.length === 0) return null;

    // Ordena por relevância
    agents.sort((a, b) => b.getRelevance(userMessage, context) - a.getRelevance(userMessage, context));
    return agents[0];
  }

  // Retorna info sobre todos os agentes (para debug)
  getAgentsInfo() {
    const info = {};
    for (const [name, agent] of this.agents) {
      info[name] = {
        tradition: agent.tradition,
        domains: agent.config.primaryDomains,
        style: agent.config.argumentStyle,
        strengths: agent.config.strengths
      };
    }
    return info;
  }
}

module.exports = { AgentFactory };
