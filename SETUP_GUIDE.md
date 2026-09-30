# BPMAC WhatsApp Webhook - Setup Guide

## Versión Mejorada con Neon PostgreSQL

Este proyecto ha sido actualizado para incluir persistencia de base de datos con Neon PostgreSQL y tarifas de despacho integradas.

**Última actualización:** Base de datos PostgreSQL configurada en Vercel (29 Sep 2026).

## 🎯 Estado de Integración: ✅ COMPLETO

### Pasos Completados:
1. ✅ Conexión a Neon PostgreSQL (DATABASE_URL configurado)
2. ✅ Tabla `conversation_history` inicializada
3. ✅ Webhook validando y guardando mensajes en base de datos
4. ✅ Historial persistente entre sesiones
5. ✅ Tarifas RM/EPS integradas en respuestas
6. ✅ Prompt mejorado con 600+ líneas de contexto BPMAC

### ✅ Cambios Realizados

#### 1. **Nuevos Archivos**
- `lib/db.js` - Conexión a Neon PostgreSQL y operaciones de historial
- `lib/tarifas.js` - Tarifas de despacho RM (Zonas 1-3) y EPS (100+ comunas)
- `SETUP_GUIDE.md` - Este archivo

#### 2. **Archivos Actualizados**
- `api/webhook.js` - Ahora usa base de datos en lugar de memoria
- `package.json` - Agregada dependencia `@neondatabase/serverless`

#### 3. **Mejoras Técnicas**
- ✅ Historial persistente en Neon PostgreSQL
- ✅ Sistema prompt mejorado con 600+ líneas de contexto BPMAC
- ✅ Soporte para tarifas RM y EPS
- ✅ Inicialización automática de base de datos
- ✅ Manejo robusto de errores

---

## 🚀 Pasos de Implementación

### Paso 1: Crear Base de Datos en Neon

1. Ir a [neon.tech](https://neon.tech) y crear una cuenta
2. Crear un nuevo proyecto PostgreSQL
3. Copiar la connection string (DATABASE_URL)
4. Guardar en lugar seguro

### Paso 2: Configurar Variables de Entorno en Vercel

En tu proyecto Vercel (Settings → Environment Variables), agregar:

```
DATABASE_URL=postgresql://user:password@...neon.tech/dbname
VERIFY_TOKEN=bpmac2026
WHATSAPP_TOKEN=tu_token_de_meta
PHONE_NUMBER_ID=tu_id_de_numero
ANTHROPIC_API_KEY=tu_api_key_claude
```

### Paso 3: Instalar Dependencias

```bash
npm install
# o
yarn install
```

Esto instalará `@neondatabase/serverless`.

### Paso 4: Inicializar la Base de Datos

**Opción A: Desde el Dashboard de Vercel**

```
https://tu-dominio.vercel.app/api/webhook?init=true
```

Debe retornar: `{"success":true,"message":"Database initialized"}`

**Opción B: Ejecutar localmente**

```bash
vercel dev
# En otra terminal:
curl "http://localhost:3000/api/webhook?init=true"
```

### Paso 5: Conectar WhatsApp Business

1. Ir a Meta Business Platform
2. Configurar webhook a: `https://tu-dominio.vercel.app/api/webhook`
3. Token de verificación: el valor de `VERIFY_TOKEN`
4. Suscribirse a eventos: `messages`, `message_status`

### Paso 6: Pruebas

Enviar un mensaje de WhatsApp a tu número configurado. El bot debe:
1. ✅ Recibir el mensaje
2. ✅ Guardar en BD Neon
3. ✅ Enviar respuesta desde Claude
4. ✅ Guardar la respuesta en BD

---

## 📊 Estructura de Base de Datos

### Tabla: `conversation_history`

```sql
CREATE TABLE conversation_history (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  role VARCHAR(10) NOT NULL,      -- 'user' o 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(phone_number, created_at),
  INDEX(phone_number, created_at DESC)
);
```

- **Almacenamiento:** Últimos 20 mensajes por conversación (configurable en `getConversationHistory`)
- **Limpieza:** Mensajes > 30 días se pueden purgar con `cleanupOldConversations()`
- **Rendimiento:** Índice en phone_number + created_at para búsquedas rápidas

---

## 📋 System Prompt - Características

El sistema prompt ahora incluye:

- ✅ Información completa de BPMAC
- ✅ Horarios de atención (L-V 9-18, S 9-13)
- ✅ 7 productos principales con especificaciones
- ✅ Rendimientos exactos (kg/m², densidades, etc.)
- ✅ Tarifas y formas de pago
- ✅ Flujo de ventas de 7 pasos
- ✅ Instrucciones en español chileno
- ✅ Restricciones de venta (Mapei solo pallet, NatStone flexible)

---

## 🔧 Configuración Avanzada

### Cambiar Límite de Historial

En `api/webhook.js`, línea 161:
```javascript
const history = await getConversationHistory(from, 10);  // Cambiar 10 por N
```

### Actualizar Tarifas

Las tarifas están en `lib/tarifas.js`. Última actualización: **11-jul-2026**

- `TARIFAS_EPS` - Precios por comuna (con IVA)
- `TARIFAS_RM` - Precios por zona (sin IVA)

Para actualizar, reemplazar los valores en las estructuras correspondientes.

### Limpiar Conversaciones Antiguas

Crear un Vercel Cron Job que ejecute:
```
GET /api/webhook?cleanup=true
```

Requiere agregar este bloque en `api/webhook.js`:
```javascript
if (req.method === 'GET' && req.query.cleanup === 'true') {
  await cleanupOldConversations();
  return res.status(200).json({ cleaned: true });
}
```

---

## 🐛 Troubleshooting

### Error: `DATABASE_URL is not defined`
- Verificar que `DATABASE_URL` está en Vercel Environment Variables
- Redeploy después de agregar la variable

### Error: `CREATE TABLE failed`
- La tabla ya existe (no es error)
- Revisar logs: `vercel logs`

### Historial no persiste
- Verificar conexión a Neon: `ping neon.tech`
- Revisar DATABASE_URL está completo
- Revisar logs de base de datos en Neon Console

### Claude no responde
- Verificar `ANTHROPIC_API_KEY` es válido
- Revisar que no hay límite de cuota excedido
- Ver logs: `vercel logs --tail`

### WhatsApp no recibe respuestas
- Verificar `WHATSAPP_TOKEN` es válido
- Verificar `PHONE_NUMBER_ID` coincide
- Revisar webhook está verificado (GET con token)

---

## 📈 Monitoreo

### En Neon Console
- Ver queries y rendimiento en tiempo real
- Monitorear crecimiento de tabla
- Configurar alertas de límites

### En Vercel
- Dashboard → Functions → Logs
- Ver todas las request/response
- Monitorear latencia

---

## ✨ Próximos Pasos (Opcionales)

- [ ] Agregar caché en Redis para tarifas frecuentes
- [ ] Implementar analytics de conversaciones
- [ ] Agregar más productos a system prompt
- [ ] Crear dashboard de estadísticas
- [ ] Integrar con CRM para seguimiento de clientes

---

## 📞 Soporte

Para preguntas técnicas:
- Email: jibustamante@grupobpchile.com
- WhatsApp BPMAC: +56 9 8932 0455

---

**Última actualización:** 30 de septiembre, 2026
