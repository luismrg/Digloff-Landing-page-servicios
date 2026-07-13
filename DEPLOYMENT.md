# Despliegue en Hostinger (Node.js)

1. Conecta tu repositorio de GitHub a Hostinger (Hosting → Deployments / Node.js app).
2. En la configuración de despliegue, ajusta:
   - Build command: `npm run build`
   - Start command: `npm start`
   - Node version: selecciona `22.x` (o la versión que uses localmente)
3. Variables de entorno (añádelas en el panel de Hostinger):
   - `ADMIN_USER` = `digloff_admin`
   - `ADMIN_PASSWORD` = `V3rY$tr0ngP@ssw0rd!`

   Nota: No guardes la contraseña real en el repositorio. Usa el panel de Hostinger para añadirlas.
   Si no defines estas variables en Hostinger, el panel de administración siempre dará "Contraseña incorrecta".

4. Verifica que el servidor remoto recibe las variables:
   - Abre `https://<tu-dominio>/admin/env-check`
   - Debe devolver `{"ok":true,"adminUserConfigured":true,"adminPasswordConfigured":true}`

5. Si Hostinger usa la fase `build`, ahora existirá el script `build` en `package.json` y no fallará.
5. Prueba el despliegue y revisa los logs en Hostinger si algo falla.

Opcional: usar GitHub Actions o Secrets
- Puedes almacenar `ADMIN_USER` y `ADMIN_PASSWORD` en GitHub Secrets y pasarlos en un workflow si usas CI. Para despliegue directo desde Hostinger, añade las variables en el panel de Hostinger.
