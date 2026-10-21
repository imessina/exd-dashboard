# Validación del chat TalentIA

Desde `backend`, ejecutar:

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -v
```

Desde `frontend`, ejecutar:

```powershell
node --test tests/chat-stream.test.mjs
npm run build
```

Las pruebas simulan AWS, Supabase y las respuestas HTTP; no consultan servicios reales.

## Compatibilidad

- Publicar frontend y backend juntos: `/api/ai/chat` requiere el token Bearer de Supabase además de la API key existente. El usuario debe estar activo en `usuarios_autorizados`.
- El servidor deriva la sesión del agente a partir del usuario autenticado y la sesión del navegador. La primera consulta después de esta actualización inicia un contexto nuevo; las siguientes conservan ese contexto mientras el agente lo mantenga en memoria.
- En modo local se transmite `X-Amzn-Bedrock-AgentCore-Runtime-Session-Id`, conforme al [contrato de sesiones de AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-troubleshooting.html).
- No se modifican colores, disposición visual, herramientas ni instrucciones del agente.
- Verificar en el entorno desplegado el inicio de sesión, dos consultas consecutivas y la llegada progresiva del texto: las pruebas locales no comprueban el buffering del proveedor de hosting.
