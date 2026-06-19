// BPMAC WhatsApp + Claude Webhook
// Deploy en Vercel como función serverless

const VERIFY_TOKEN = process.env.VERIFY_TOKEN; // Define en Vercel: "bpmac2026"
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; // Token de acceso de Meta
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID; // ID del número de teléfono
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY; // Tu API key de Claude

// System prompt con contexto completo de BPMAC
const SYSTEM_PROMPT = `Eres el asistente técnico de ventas de BPMAC, distribuidor especializado en materiales de construcción en Chile.

PRODUCTOS PRINCIPALES Y RENDIMIENTOS:
- Aquaflex Techos Plus: impermeabilizante para techos. Rendimiento: 0.6 kg/m² por mano. Aplicar 2 manos = 1.2 kg/m². Disponible en Blanco y Gris (NO Rojo Teja). Balde 20 kg.
- Mapelastic Aquadefense: impermeabilizante para baños y terrazas. Rendimiento: 0.3-0.5 kg/m² por mano. 2 manos mínimo.
- EPS Aislapol: planchas de poliestireno expandido para aislación térmica sistema EIFS. Densidades 10-25 kg/m³.
- Espuma Poliuretano Soudal/Mapei: sellado y relleno. 
- NatStone Adhesivo Porcelanato 25 kg: rendimiento 1.8-2.0 kg/m² por mm de espesor. Clasificación C2S1.
- Soudaflex 40FC: sellador poliuretano para juntas.
- Adhesivo Afix Green Montaje: adhesivo de montaje.

INFORMACIÓN COMERCIAL:
- Despacho a todo Chile vía FedEx (sin límite de peso/tamaño) y Blue Express (hasta 20kg, 70x70x70cm)
- Mapei se vende solo por pallet completo
- NatStone es flexible: por unidad o pallet
- WhatsApp BPMAC: +56 9 8932 0455
- Web: bpmac.cl

INSTRUCCIONES:
1. Saluda cordialmente como asesor técnico de BPMAC
2. Cuando el cliente describa su proyecto, identifica: tipo de trabajo, superficie en m², soporte
3. Recomienda el producto correcto con cantidad exacta calculada
4. Indica precio aproximado si lo preguntan (consultar disponibilidad)
5. Al final siempre ofrece: "¿Te envío esta cotización por escrito o prefieres que te contacte un ejecutivo?"
6. Responde siempre en español chileno, tono profesional pero cercano
7. Respuestas concisas, máximo 3-4 párrafos
8. Si no sabes algo, di "te consulto con nuestro equipo y te confirmo"`;

// Historial de conversaciones en memoria (se resetea con cada deploy)
const conversationHistory = {};

export default async function handler(req, res) {
  
  // ── VERIFICACIÓN DEL WEBHOOK (GET) ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Token inválido');
  }

  // ── RECEPCIÓN DE MENSAJES (POST) ──
  if (req.method === 'POST') {
    const body = req.body;

    // Verificar que es un mensaje de WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      return res.status(404).send('Not found');
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.status(200).send('OK'); // Sin mensajes, ignorar
    }

    const message = messages[0];
    const from = message.from; // Número del cliente
    const messageText = message.text?.body;

    if (!messageText) {
      return res.status(200).send('OK'); // Ignorar mensajes no-texto (imágenes, etc.)
    }

    console.log(`Mensaje de ${from}: ${messageText}`);

    try {
      // ── MANTENER HISTORIAL POR NÚMERO ──
      if (!conversationHistory[from]) {
        conversationHistory[from] = [];
      }

      conversationHistory[from].push({
        role: 'user',
        content: messageText
      });

      // Limitar historial a últimos 10 mensajes para no exceder tokens
      if (conversationHistory[from].length > 10) {
        conversationHistory[from] = conversationHistory[from].slice(-10);
      }

      // ── LLAMADA A CLAUDE ──
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: conversationHistory[from]
        })
      });

      const claudeData = await claudeResponse.json();
      const reply = claudeData.content?.[0]?.text;

      if (!reply) {
        throw new Error('Sin respuesta de Claude');
      }

      // Guardar respuesta en historial
      conversationHistory[from].push({
        role: 'assistant',
        content: reply
      });

      // ── ENVIAR RESPUESTA POR WHATSAPP ──
      await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: reply }
        })
      });

      console.log(`Respuesta enviada a ${from}`);
      return res.status(200).send('OK');

    } catch (error) {
      console.error('Error:', error);
      return res.status(500).send('Error interno');
    }
  }

  return res.status(405).send('Método no permitido');
}
