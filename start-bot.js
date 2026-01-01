require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const qrcode = require('qrcode-terminal');
const { Orchestrator } = require('./core/orchestrator');

// Inicializa o orquestrador multi-agente
const orchestrator = new Orchestrator();

// Buffer de mensagens por usuário
const messageBuffer = new Map();
const BUFFER_DELAY = 4000; // 4 segundos para acumular mensagens

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fragmenta mensagem para WhatsApp
function fragmentMessage(text) {
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

// Escolhe emoji baseado na resposta
function selectReactionEmoji(agentTradition) {
  const emojis = {
    'Christian': ['✝️', '💛', '🙏'],
    'Greek': ['🏛️', '💭', '🔥'],
    'Stoic': ['🛡️', '⚔️', '🧘'],
    'Eastern': ['☮️', '🌸', '✨'],
    'Modern': ['💡', '🚀', '⚡']
  };

  const tradition = agentTradition || 'Christian';
  const emojisForTradition = emojis[tradition] || emojis['Christian'];
  return emojisForTradition[Math.floor(Math.random() * emojisForTradition.length)];
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('bot_sessions');

  const connectToWhatsApp = async () => {
    const sock = makeWASocket({
      auth: state,
      browser: ['Multi-Agent Wisdom', 'Chrome', '2.0.0']
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 ESCANEIE O QR CODE COM O WHATSAPP:\n');
        qrcode.generate(qr, { small: true });

        // Salva o QR code em arquivo para acesso remoto
        fs.writeFileSync(path.join(__dirname, 'qr_code.txt'), qr);
        console.log(`✅ QR Code salvo em: /root/jesus-bot/qr_code.txt`);
      }

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Conexão fechada. Reconectando:', shouldReconnect);
        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 3000);
        }
      } else if (connection === 'open') {
        console.log('\n✅ MULTI-AGENT WISDOM BOT - CONECTADO!');
        console.log(`🤖 ${orchestrator.getStatus().totalAgents} agentes carregados`);
        console.log('📱 Mande uma mensagem para conversar com os agentes\n');
        console.log('Agentes ativos:');
        console.log(orchestrator.getStatus().agents.join(', '));
        console.log('');
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

      if (!text.trim()) return;

      console.log(`📩 ${from}: ${text}`);

      // Buffer: acumula mensagens seguidas
      if (!messageBuffer.has(from)) {
        messageBuffer.set(from, { texts: [], msgKey: null, timer: null, originalMsg: null });
      }

      const buffer = messageBuffer.get(from);
      buffer.texts.push(text);
      buffer.msgKey = msg.key;
      buffer.originalMsg = msg.message;

      // Cancela timer anterior se existir
      if (buffer.timer) {
        clearTimeout(buffer.timer);
      }

      // Novo timer: espera 4s por mais mensagens
      buffer.timer = setTimeout(async () => {
        const allTexts = buffer.texts.join('\n');
        const quotedKey = buffer.msgKey;
        const quotedMsg = buffer.originalMsg;
        buffer.texts = [];
        buffer.msgKey = null;
        buffer.originalMsg = null;
        buffer.timer = null;

        console.log(`💬 Processando ${allTexts.split('\n').length} msg(s) de ${from}`);

        try {
          // Delay natural antes de responder
          await delay(1000 + Math.random() * 2000);

          // Mostra "digitando"
          await sock.sendPresenceUpdate('composing', from);

          // Processa mensagem com orquestrador
          const responses = await orchestrator.processMessage(allTexts, from);

          // Para de "digitar"
          await sock.sendPresenceUpdate('paused', from);

          if (responses.length === 0) {
            // Fallback se nenhum agente respondeu
            await sock.sendMessage(from, {
              text: 'Os agentes estão refletindo... tente novamente.'
            });
            return;
          }

          // Envia resposta por agente
          for (let i = 0; i < responses.length; i++) {
            const r = responses[i];

            // Delay entre agentes (2-4s)
            await delay(2000 + Math.random() * 2000);
            await sock.sendPresenceUpdate('composing', from);
            await delay(1000 + Math.random() * 1500);
            await sock.sendPresenceUpdate('paused', from);

            // Formata resposta
            const agentHeader = `*${r.agent}*`;
            const fullResponse = `${agentHeader} (${r.tradition})\n\n${r.response}`;

            // Fragmenta se necessário
            const fragments = fragmentMessage(fullResponse);

            for (let j = 0; j < fragments.length; j++) {
              if (j === 0 && quotedKey && quotedMsg && i === 0) {
                // Primeira mensagem, primeira resposta - cita original
                await sock.sendMessage(from, {
                  text: fragments[j],
                  quoted: { key: quotedKey, message: quotedMsg }
                });
              } else {
                await sock.sendMessage(from, {
                  text: fragments[j]
                });
              }

              // Delay entre fragmentos
              if (j < fragments.length - 1) {
                await delay(1500 + Math.random() * 1500);
              }
            }

            // Reação com emoji apropriado
            const emoji = selectReactionEmoji(r.tradition);
            await sock.sendMessage(from, {
              react: { text: emoji, key: msg.key }
            });
          }

          console.log(`✉️ ${responses.length} agentes responderam`);
        } catch (error) {
          console.error('Erro ao processar mensagem:', error.message);
          await sock.sendMessage(from, {
            text: 'Oops, algo não funcionou. Os agentes estão refletindo...'
          });
        }
      }, BUFFER_DELAY);
    });
  };

  connectToWhatsApp();
}

// Banner de boas-vindas
console.log(`
╔═══════════════════════════════════════════════════╗
║         MULTI-AGENT WISDOM PLATFORM v2.0          ║
╠═══════════════════════════════════════════════════╣
║  🤖 Agentes: Jesus, Paulo, Francisco, Sócrates   ║
║     Platão, Aristóteles, Marco Aurélio,          ║
║     Epicteto, Sêneca                              ║
║  💬 Modo: Diálogos Multi-Agentes Interativos     ║
║  🌍 Tradições: Cristã, Grega, Estoica            ║
║  ⚡ Status: Iniciando...                          ║
╚═══════════════════════════════════════════════════╝
`);

startBot().catch(console.error);
