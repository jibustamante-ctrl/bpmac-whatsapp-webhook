import { Pool } from '@neondatabase/serverless';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_z4d1bmxECGRp@ep-winter-star-b4ds5jyw-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function checkDatabase() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT phone_number, role, LEFT(content, 100) as content_preview, created_at 
       FROM conversation_history 
       ORDER BY created_at DESC 
       LIMIT 10`
    );
    
    console.log('✅ Mensajes en base de datos:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length === 0) {
      console.log('❌ No hay mensajes guardados aún');
    } else {
      console.log(`\n✅ Total de mensajes: ${result.rows.length}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkDatabase();
