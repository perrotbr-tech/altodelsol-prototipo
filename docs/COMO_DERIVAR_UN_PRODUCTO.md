# Cómo derivar un producto desde el asistente base

Pasos usados para Alto del Sol (repetibles en el próximo rubro):

1. Clonar la rama de producto del asistente conversacional (`git clone --depth 1 --branch …`) a un directorio temporal. Si el clon falla, detenerse; no reconstruir de memoria.
2. Copiar a la raíz del repo nuevo todo salvo `.git`, `/data`, `/brand`, `/tests` y capturas. Conservar `index.html`, `app.js`, `styles.css`, `/engine`, `/server`, `/channels`, `package.json` y `.cursor/environment.json`.
3. Sustituir la regla `.cursor/rules/*.mdc`: mismas normas de arquitectura, interfaz y calidad; cambiar solo Contexto y Reglas de negocio del rubro.
4. Puertos en `environment.json` como objetos `{ "name": "app", "port": 3000 }`.
5. Borrar `/data` y `/tests` del origen; escribir datos, i18n y tests del nuevo dominio. El engine sigue isomórfico: `evaluar(contexto, fechaRef) → acciones[]`, StoreLocal, login con bloqueo, tema por CSS variables.
6. Renombrar en código y textos los conceptos del rubro origen. Eliminar lo que no aplica. Un test debe fallar si reaparece vocabulario viejo en textos visibles.
7. Tres pantallas de punta a punta en 375 px, modo estático (`python3 -m http.server`). Priorizar un flujo completo si el tiempo no alcanza.
8. Tests con `node --test tests/` (sin servidor): aislamiento, correlativos, reglas, asistente, agentes, login.
9. README de uso + este documento. Un PR, sin merge.

Qué se copia: esqueleto Node 20, Express opcional, frontend estático, dates/auth, patrón de agentes.
Qué se borra: datos, marca, tests, agentes y catálogo del rubro anterior.
Qué se adapta: store, conversación, intents, automatizaciones, HTML/CSS/app, usuarios demo.
