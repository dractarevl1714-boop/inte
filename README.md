# Chatbot Gemini

Un chatbot web interactivo alimentado por la API de Google Gemini, diseñado con una interfaz moderna similar a Gemini.

## Características

- ✨ Interfaz limpia y moderna
- 🤖 Powered by Google Gemini API
- 💬 Chat en tiempo real
- 📱 Responsivo para móviles y desktop
- 🚀 Fácil de implementar

## Requisitos

- Node.js 14+ 
- npm o yarn
- API key de Google Gemini

## Instalación

1. **Instalar dependencias**
```bash
npm install
```

2. **Configurar variables de entorno**
El archivo `.env` ya contiene tu API key. Si necesitas cambiarla:
```
GEMINI_API_KEY=tu_api_key_aqui
PORT=3000
```

3. **Iniciar el servidor**
```bash
npm start
```

O para desarrollo con recarga automática:
```bash
npm run dev
```

4. **Acceder a la aplicación**
Abre tu navegador en: `http://localhost:3000`

## Estructura del Proyecto

```
.
├── public/
│   ├── index.html      # Interfaz frontend
│   ├── style.css       # Estilos
│   └── script.js       # Lógica del cliente
├── server.js           # Servidor Express
├── .env                # Variables de entorno
├── package.json        # Dependencias
└── README.md           # Este archivo
```

## Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **API**: Google Generative AI (Gemini)
- **Middleware**: CORS, dotenv

## Uso

1. Escribe tu mensaje en el campo de entrada
2. Presiona Enter o haz clic en el botón "Enviar"
3. Espera la respuesta del asistente de IA
4. ¡Continúa la conversación!

## Licencia

MIT

## Autor

Creado con ❤️
