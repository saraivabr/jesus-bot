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
      browser: ['Multi-Agent Wisdom', 'Chrome', '2.0.0'],
      generateHighQualityLinkPreview: true,
      printQRInTerminal: true,
      passive: false,
      syncFullHistory: true,
      markOnlineOnConnect: true
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 ESCANEIE O QR CODE COM O WHATSAPP:\n');
        qrcode.generate(qr, { small: true });

        // Salva o QR code em arquivo para acesso remoto
        try {
          fs.writeFileSync(path.join(__dirname, 'qr_code.txt'), qr);
          console.log(`✅ QR Code salvo em: /root/jesus-bot/qr_code.txt`);
        } catch (e) {
          console.error('Erro ao salvar QR code:', e.message);
        }
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

    sock.ev.on('messages.upsert', async ({type, messages}) => {
      try {
        console.log('🔔 Evento messages.upsert recebido:', messages?.length, 'mensagens, type:', type);

        // IMPORTANTE: Só processa mensagens de notificação (mensagens de usuários)
        if (type !== 'notify') {
          console.log('⏭️ Ignorando type:', type, '(não é notify)');
          return;
        }

        // Processa TODAS as mensagens, não apenas a primeira
        for (const msg of messages) {
          if (!msg) {
            console.log('⚠️ Mensagem vazia recebida');
            continue;
          }

          console.log('✓ Mensagem extraída, fromMe:', msg.key.fromMe);
          if (msg.key.fromMe) {
            console.log('↪️ Mensagem própria ignorada');
            continue;
          }

        let text = '';
        if (msg.message?.conversation) {
          text = msg.message.conversation;
          console.log('✓ Texto extraído de .conversation');
        } else if (msg.message?.extendedTextMessage?.text) {
          text = msg.message.extendedTextMessage.text;
          console.log('✓ Texto extraído de .extendedTextMessage');
        } else {
          const msgKeys = Object.keys(msg.message || {});
          console.log('⚠️ Tipo de mensagem não suportado:', msgKeys);
          console.log('📋 Estrutura completa:', JSON.stringify(msg.message, null, 2).substring(0, 500));
          return;
        }

        if (!text.trim()) {
          console.log('⚠️ Mensagem vazia (sem texto)');
          return;
        }

        const from = msg.key.remoteJid;
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
            console.log('📝 Enviando status "digitando"...');
            await sock.sendPresenceUpdate('composing', from);

            // Processa mensagem com orquestrador
            console.log('🧠 Chamando orchestrator.processMessage...');
            const responses = await orchestrator.processMessage(allTexts, from);
            console.log(`✅ Orquestrador retornou ${responses.length} respostas`);

            // Para de "digitar"
            await sock.sendPresenceUpdate('paused', from);

            if (responses.length === 0) {
              // Fallback se nenhum agente respondeu
              console.log('⚠️ Nenhuma resposta recebida. Enviando fallback...');
              await sock.sendMessage(from, {
                text: 'Os agentes estão refletindo... tente novamente.'
              });
              console.log('✉️ Mensagem de fallback enviada');
              return;
            }

            console.log(`📤 Enviando ${responses.length} respostas para ${from}`);

            // Delay natural antes de responder
            await delay(2000 + Math.random() * 1000);
            await sock.sendPresenceUpdate('composing', from);
            await delay(1000 + Math.random() * 1500);
            await sock.sendPresenceUpdate('paused', from);

            // Consolida respostas de múltiplos agentes em uma mensagem
            let fullMessage = '';
            if (responses.length === 1) {
              // Resposta única - formato simples
              const r = responses[0];
              const emoji = selectReactionEmoji(r.tradition);
              fullMessage = `*${r.agent}* ${emoji}\n\n${r.response}`;
            } else {
              // Múltiplos agentes - consolida com separadores visuais
              fullMessage = responses.map((r, i) => {
                const emoji = selectReactionEmoji(r.tradition);
                const divider = i < responses.length - 1 ? '\n\n━━━━━━━━━━━\n\n' : '';
                return `*${r.agent}* ${emoji}\n\n${r.response}${divider}`;
              }).join('');
            }

            // Envia mensagem consolidada
            if (quotedKey && quotedMsg) {
              await sock.sendMessage(from, {
                text: fullMessage,
                quoted: { key: quotedKey, message: quotedMsg }
              });
            } else {
              await sock.sendMessage(from, {
                text: fullMessage
              });
            }

            console.log(`✉️ ${responses.length} agentes responderam (consolidado em 1 mensagem`);
          } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error.message);
            console.error('📋 Stack:', error.stack);
            try {
              await sock.sendMessage(from, {
                text: 'Oops, algo não funcionou. Os agentes estão refletindo...'
              });
            } catch (sendError) {
              console.error('❌ Erro ao enviar mensagem de erro:', sendError.message);
            }
          }
        }, BUFFER_DELAY);
        } // fim do for loop de messages
      } catch (error) {
        console.error('❌ Erro no handler de mensagens:', error.message);
      }
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
