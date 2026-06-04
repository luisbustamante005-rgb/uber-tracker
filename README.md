# 🚗 Uber Tracker — Luis

Panel personal para registrar viajes, ingresos, combustible y gastos del auto. Se conecta a Google Sheets como base de datos y se aloja en GitHub Pages.

---

## Arquitectura

```
[GitHub Pages] ←──── HTML/CSS/JS (app.js)
                           │
                           ▼ fetch()
                 [Apps Script Web App]
                           │
                           ▼
                   [Google Sheets]
                  ┌────────┬────────┐
                  │ Viajes │ Gastos │
                  └────────┴────────┘
```

---

## Pasos de instalación

### 1. Subir a GitHub Pages

```bash
# Crear repo en GitHub (nombre sugerido: uber-tracker)
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/uber-tracker.git
git push -u origin main

# En GitHub → Settings → Pages → Source: main branch / root
# URL: https://TU_USUARIO.github.io/uber-tracker/
```

### 2. Configurar Google Apps Script

1. Crea un **Google Sheet** nuevo, nómbralo `UberTracker`
2. **Extensiones → Apps Script**
3. Borra el contenido y pega el código de `apps-script.gs`
4. Guarda (Ctrl+S)
5. **Implementar → Nueva implementación**
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo (tu cuenta)**
   - Acceso: **Cualquier persona**
6. Click en **Implementar** y autoriza los permisos
7. Copia la URL de la Web App (formato: `https://script.google.com/macros/s/.../exec`)

### 3. Conectar la app

1. Abre tu GitHub Pages: `https://TU_USUARIO.github.io/uber-tracker/`
2. Click en ⚙ (esquina superior derecha)
3. Pega la URL del Apps Script
4. Click **Guardar configuración**
5. La app se conecta y muestra tus datos

---

## Estructura del Google Sheet

Se crean automáticamente 2 hojas:

### Hoja: Viajes
| Fecha | HoraInicio | HoraFin | Horas | CantidadViajes | Ingresos | Propinas | Peajes | Turno | Total | Notas | Timestamp |

### Hoja: Gastos
| Fecha | Categoria | Monto | Litros | Fondo | Notas | Timestamp |

---

## Distribución de fondos

Los ingresos brutos se distribuyen automáticamente:

| Fondo       | % |
|-------------|---|
| ✈ Viaje     | 30% |
| 🔧 Mantención | 20% |
| 📚 Universidad | 15% |
| 🛟 Emergencia | 15% |
| 🛣 Peajes   | 10% |
| 🏠 Casa     | 10% |

Para cambiar los porcentajes, edita `FONDOS_PCT` en `app.js`.

---

## Archivos

```
uber-tracker/
├── index.html      ← App principal
├── style.css       ← Estilos
├── app.js          ← Lógica y conexión a Sheets
├── apps-script.gs  ← Backend (pegar en Google Apps Script)
└── README.md       ← Este archivo
```

---

## Actualizar script existente

Si ya tienes una implementación y necesitas actualizar:
**Implementar → Administrar implementaciones → ✏️ Editar → Nueva versión → Implementar**

La URL no cambia.
