// lib/db.js — Neon PostgreSQL Database Setup
// Conexión y operaciones para historial de conversaciones WhatsApp

import { Pool } from '@neondatabase/serverless';

// Pool de conexiones a Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Inicializar la tabla si no existe
 * Ejecutar UNA SOLA VEZ al deployar por primera vez
 */
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversation_history (
        id SERIAL PRIMARY KEY,
        phone_number VARCHAR(20) NOT NULL,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_conversation UNIQUE (phone_number, created_at)
      );

      CREATE INDEX IF NOT EXISTS idx_phone_created
        ON conversation_history(phone_number, created_at DESC);
    `);
    console.log('✅ Database initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Obtener historial de conversación de un número
 * @param {string} phoneNumber - Número de teléfono del cliente
 * @param {number} limit - Últimos N mensajes (default: 20)
 */
export async function getConversationHistory(phoneNumber, limit = 20) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT role, content FROM conversation_history
       WHERE phone_number = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [phoneNumber, limit]
    );

    // Invertir orden para que el más antiguo esté al inicio
    return result.rows.reverse();
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  } finally {
    client.release();
  }
}

/**
 * Guardar un mensaje en el historial
 * @param {string} phoneNumber - Número de teléfono
 * @param {string} role - 'user' o 'assistant'
 * @param {string} content - Contenido del mensaje
 */
export async function saveMessage(phoneNumber, role, content) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO conversation_history (phone_number, role, content)
       VALUES ($1, $2, $3)`,
      [phoneNumber, role, content]
    );
  } catch (error) {
    console.error('Error saving message:', error);
    // No lanzar error — el chat debe seguir funcionando aunque falle la BD
  } finally {
    client.release();
  }
}

/**
 * Limpiar conversaciones antiguas (más de 30 días)
 * Ejecutar periódicamente desde un cron job
 */
export async function cleanupOldConversations() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM conversation_history
       WHERE created_at < NOW() - INTERVAL '30 days'`
    );
    console.log(`🧹 Cleaned up ${result.rowCount} old messages`);
  } catch (error) {
    console.error('Error cleaning up conversations:', error);
  } finally {
    client.release();
  }
}

export default pool;
