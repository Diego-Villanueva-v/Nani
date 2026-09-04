# Nani

Nani es una aplicación web de chat en tiempo real con registro/inicio de sesión, salas, mensajes directos y perfiles de usuario.

## Funcionalidades principales

- Registro e inicio de sesión con Firebase Authentication
- Inicio de sesión con Google
- Recuperación de contraseña por correo
- Chat en salas públicas y mensajes directos
- Lista de usuarios conectados en tiempo real
- Perfil de usuario con avatar y preferencias visuales

## Tecnologías usadas

- HTML, CSS y JavaScript (frontend)
- Firebase (Authentication + Firestore)
- Socket.IO
- Node.js + Express (servidor de sockets)

## Estructura del proyecto

- `index.html`: pantalla de inicio de sesión
- `registro.html`: pantalla de registro
- `chat.html`: interfaz principal del chat
- `login.js`, `script.js`, `chat.js`: lógica del cliente
- `server.js`: servidor Socket.IO
- `style.css`: estilos de la aplicación

## Requisitos

- Node.js 18 o superior
- npm

## Instalación

```bash
npm install
```

## Ejecución del servidor de sockets

```bash
npm start
```

El servidor se levanta por defecto en el puerto `8000` (o el definido en `PORT`).

## Nota para desarrollo local

Actualmente el cliente en `chat.js` usa una URL de Socket.IO desplegada en Railway (`https://chat-project-production-b900.up.railway.app`).
Si deseas trabajar 100% local, cambia esa URL por tu servidor local (por ejemplo `http://localhost:8000`).
