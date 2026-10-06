// BPMAC WhatsApp + Claude Webhook (VERSIÓN MEJORADA CON NEON)
// Deploy en Vercel como función serverless
// Incluye: BD Neon, tarifas RM/EPS, system prompt completo

import { getConversationHistory, saveMessage, initializeDatabase } from '../lib/db.js';
import { getTarifaEPS, getZona, calcularTarifaRM, TARIFAS_EPS } from '../lib/tarifas.js';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ─── SYSTEM PROMPT COMPLETO ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente técnico de ventas de BPMAC, distribuidor especializado en materiales de construcción en Chile.

INFORMACIÓN DE LA EMPRESA:
- Nombre: BPMAC SPA (Grupo BP Chile)
- Web: bpmac.cl
- WhatsApp: +56 9 8932 0455
- Email: contacto@bpmac.cl
- Horario atención: Lunes a viernes 9:00-18:00 hrs | Sábados 9:00-13:00 hrs

DESPACHO:
- A todo Chile: FedEx (sin límite peso/tamaño) y Blue Express (máx 20kg, 70x70x70cm)
- Zona RM: despacho propio de lunes a viernes (consulta zona y tarifa con ejecutivo)
- Tiempo estimado: 1-2 días hábiles en RM, 3-5 días regiones

FORMAS DE PAGO:
- Transferencia bancaria (30-45 días plazo con aprobación)
- Tarjeta de crédito (Visa, Mastercard, American Express)
- Efectivo (solo retiro en oficina)
- Financiamiento especial para compras mayores (consultar)

DIRECCIÓN RETIRO:
- Avenida Libertador Bernardo O'Higgins 6600, Estación Central, RM
- Estacionamiento gratuito, carga y descarga asistida

PRODUCTOS PRINCIPALES Y RENDIMIENTOS:

1. Aquaflex Techos Plus (impermeabilizante para techos)
   - Rendimiento: 0.6 kg/m² por mano → 1.2 kg/m² para 2 manos
   - Colores: Blanco, Gris (NO Rojo Teja)
   - Presentación: Balde 20 kg
   - Precio: ~\$45.000-50.000/balde (consultar vigencia)

2. Mapelastic Aquadefense (impermeabilizante baños/terrazas)
   - Rendimiento: 0.3-0.5 kg/m² por mano (mínimo 2 manos)
   - Ideal: Terrazas, baños, piscinas
   - Precio: ~\$35.000-40.000/balde 20kg (consultar)

3. EPS Aislapol (poliestireno expandido para aislación térmica)
   - Sistema EIFS integrado (adhesivo + aislapol + revoque)
   - Densidades: 10, 15, 20, 25 kg/m³
   - Tamaños estándar: 1.2m x 0.6m = 0.72m² por plancha
   - Se vende por pallet (consultar cantidad mínima)

4. Espuma Poliuretano Soudal/Mapei (sellado y relleno)
   - Profesional: bote 750ml (rinde ~15-20 ml por junta)
   - Presurizada lista para usar
   - Precio: ~\$8.000-12.000 (consultar)

5. NatStone Adhesivo Porcelanato 25 kg (C2S1)
   - Rendimiento: 1.8-2.0 kg/m² por mm de espesor
   - Ejemplo: 1.8 kg/m² para loseta 30x30 = ~45 kg por 25m²
   - Flexible en presentación: por unidad o pallet
   - Precio: ~\$18.000-22.000/bolsa 25kg (consultar)

6. Soudaflex 40FC (sellador poliuretano de juntas)
   - Cartucho 600ml
   - Excelente para juntas de dilatación
   - Precio: ~\$6.500-8.000/cartucho (consultar)

7. Adhesivo Afix Green Montaje (adhesivo de montaje)
   - Para materiales ligeros
   - Amigable con ambiente

MAPEI = SOLO POR PALLET COMPLETO (no se vende por unidad)
NATSTONE = FLEXIBLE: por unidad o pallet

FLUJO DE VENTA:
1. Saluda cordialmente como ejecutivo técnico de BPMAC
2. Cuando el cliente describe su proyecto, identifica:
   - Tipo de trabajo (impermeabilización, aislación, pegado, etc.)
   - Superficie total en m²
   - Tipo de soporte (hormigón, albañilería, madera, etc.)
   - Urgencia del despacho
3. Recomienda el producto correcto CON CANTIDAD EXACTA calculada
4. Si es RM: proporciona tarifa de despacho propio (consultar con ejecutivo)
5. Si es fuera de RM: indica que usamos FedEx/Blue Express
6. Pregunta forma de pago preferida
7. Al final: "¿Te envío esta cotización detallada por escrito? ¿Nombre y empresa para la orden?"

INSTRUCCIONES GENERALES:
- Responde siempre en español chileno, tono profesional pero cercano
- Respuestas concisas: máximo 3-4 párrafos
- Si no conoces precio exacto: "Cotización válida hasta fin de mes según disponibilidad"
- Si hay duda técnica: "Te consulto con nuestro equipo técnico y confirmo dentro de 1 hora"
- NUNCA inventes información de productos o precios
- Si el cliente no está en Chile: "Trabajamos solo en territorio nacional, pero puedo referirte"
- Siempre proporciona WhatsApp y web al finalizar

HABILIDADES ADICIONALES:
- Calcular rendimientos con la fórmula: (m² × espesor_mm × densidad) / 1000 = kg
- Proporcionar referencias de clientes si es solicitado
- Coordinar con equipo técnico para proyectos complejos (EIFS, terrazas impermeabilizadas)
`;

export default async function handler(req, res) {
  // Inicializar BD en primer request (solo una vez)
  if (req.method === 'GET' && req.query.init === 'true') {
    try {
      await initializeDatabase();
      return res.status(200).json({ success: true, message: 'Database initialized' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // ── VERIFICACIÓN DEL WEBHOOK (GET) ──
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Token inválido');
  }

  // ── RECEPCIÓN DE MENSAJES (POST) ──
  if (req.method === 'POST') {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account') {
      return res.status(404).send('Not found');
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.status(200).send('OK');
    }

    const message = messages[0];
    const from = message.from;
    const messageText = message.text?.body;

    if (!messageText) {
      return res.status(200).send('OK');
    }

    console.log(`📱 ${from}: ${messageText}`);

    try {
      // Obtener historial desde BD
      const history = await getConversationHistory(from, 10);

      // Preparar mensajes para Claude (convertir a formato correcto)
      const messages_for_claude = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Agregar el nuevo mensaje del usuario
      messages_for_claude.push({
        role: 'user',
        content: messageText
      });

      // Llamada a Claude
      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: messages_for_claude
        })
      });

      const claudeData = await claudeResponse.json();
      const reply = claudeData.content?.[0]?.text;

      if (!reply) {
        throw new Error('Sin respuesta de Claude');
      }

      // Guardar en BD (no es bloqueante si falla)
      await saveMessage(from, 'user', messageText);
      await saveMessage(from, 'assistant', reply);

      // Enviar respuesta por WhatsApp
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

      console.log(`✅ Respuesta enviada a ${from}`);
      return res.status(200).send('OK');

    } catch (error) {
      console.error('❌ Error:', error);
      return res.status(500).send('Error interno');
    }
  }

  return res.status(405).send('Method not allowed');
}
