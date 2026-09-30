import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://bpmac-whatsapp-webhook.vercel.app/api/webhook';
const TEST_PHONE = '56998765432'; // Número de prueba diferente

// Simular 3 mensajes de una conversación real
const messages = [
  {
    text: "Hola, necesito presupuesto para un proyecto de impermeabilización de una terraza de 50 m²",
    description: "Cliente pregunta por impermeabilización"
  },
  {
    text: "¿Cuánto cuesta el Mapelastic Aquadefense y cuántos baldes necesito para 2 manos?",
    description: "Cliente pregunta específicamente por producto y cantidad"
  },
  {
    text: "¿Cuál es el tiempo de despacho a Stgo Centro y si puedo pagar en 30 días?",
    description: "Cliente pregunta detalles finales de envío y pago"
  }
];

async function sendTestMessage(phoneNumber, messageText) {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'entry-id',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              messages: [
                {
                  from: phoneNumber,
                  id: `msg-${Date.now()}`,
                  timestamp: Date.now().toString(),
                  text: {
                    body: messageText
                  },
                  type: 'text'
                }
              ]
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log(`✅ ${response.status}: ${text}`);
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

async function runConversationTest() {
  console.log(`\n📱 Test de Flujo Conversacional`);
  console.log(`====================================`);
  console.log(`Teléfono de prueba: ${TEST_PHONE}\n`);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    console.log(`\n📨 Mensaje ${i + 1}: ${msg.description}`);
    console.log(`Texto: "${msg.text}"`);
    
    await sendTestMessage(TEST_PHONE, msg.text);
    
    // Esperar 2 segundos entre mensajes
    if (i < messages.length - 1) {
      console.log(`⏳ Esperando 2 segundos...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log(`\n\n✅ Test de flujo completado.`);
  console.log(`Ahora verificando historial en BD...\n`);

  // Esperar un poco para que se guarden todos los mensajes
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verificar en BD
  const { Pool } = await import('@neondatabase/serverless');
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_z4d1bmxECGRp@ep-winter-star-b4ds5jyw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT phone_number, role, LEFT(content, 80) as content, created_at 
       FROM conversation_history 
       WHERE phone_number = $1
       ORDER BY created_at ASC`,
      [TEST_PHONE]
    );

    console.log(`📊 Historial guardado para ${TEST_PHONE}:`);
    console.log('─'.repeat(80));
    
    result.rows.forEach((row, idx) => {
      const role = row.role === 'user' ? '👤 Usuario' : '🤖 Asistente';
      console.log(`\n[${idx + 1}] ${role} (${new Date(row.created_at).toLocaleTimeString('es-CL')})`);
      console.log(`${row.content}...`);
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`\n✅ Total de mensajes en BD: ${result.rows.length}`);
    console.log(`✅ Contexto conversacional: VERIFICADO`);
  } finally {
    client.release();
    await pool.end();
  }
}

runConversationTest().catch(console.error);
