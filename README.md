# Hotel Alto del Sol · Prototipo

Prototipo de **gestión de huéspedes corporativos** y asistente tipo WhatsApp para un hotel independiente con tres sedes. Construido por Perrot Tech para una demo.

Abrir en GitHub Pages: https://perrotbr-tech.github.io/altodelsol-prototipo/

En local, sin servidor de aplicación:

```bash
python3 -m http.server 8080
```

Luego abre `http://localhost:8080/` (375 px). También: `npm start` (Express en el puerto 3000).

## Acceso de demostración

Clave: `demo1234`

- `recepcion@altodelsol.demo` — recepción (panel del hotel)
- `admin@altodelsol.demo` — administración (panel del hotel)
- `coordinador@mineranorte.demo` — portal de Minera Norte SpA

Pantallas: `#asistente` (sin login), `#empresa`, `#panel`, `#automatizaciones`.

Fecha de referencia: la fecha real, o `?fecha=YYYY-MM-DD` para tests y capturas.

## Qué es dato publicado y qué es demostrativo

- **Publicado:** sede Antofagasta Costanera, 48 habitaciones.
- **Demostrativo:** sedes Angamos (30) y Mejillones (24), empresas, huéspedes, RUT, teléfonos, tarifas de convenio, reservas, traslados y conversaciones. Todo ficticio. Rótulo en el panel: "Datos demostrativos · prototipo".

## Pendientes

- Envío real por WhatsApp (hoy es simulación en el navegador).
- Facturación tributaria: el portal muestra estado de cuenta informativo; la factura la emite el hotel.
- Tema visual definitivo del hotel (hoy es marca neutra de demostración).
- Persistencia en servidor compartido; el modo Pages usa almacenamiento local del navegador.

## Tests

```bash
npm test
```
