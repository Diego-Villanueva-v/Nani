document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const loginMensaje = document.getElementById('loginMensaje');

    // Inicio de sesión normal
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verificando...';

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await window.signInWithEmailAndPassword(window.auth, email, password);
            loginMensaje.textContent = '¡Bienvenido a Nani?! Redirigiendo...';
            loginMensaje.style.color = '#4CAF50';
            setTimeout(() => { window.location.href = 'chat.html'; }, 1500);
        } catch (error) {
            loginMensaje.textContent = 'Credenciales incorrectas.';
            loginMensaje.style.color = '#f44336';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Ingresar';
        }
    });

    // Inicio con Google
    googleLoginBtn.addEventListener('click', async () => {
        const provider = new window.GoogleAuthProvider();
        try {
            const result = await window.signInWithPopup(window.auth, provider);
            const user = result.user;
            
            // Verificar si es la primera vez que entra para guardarlo en la BD
            const userDoc = await window.getDoc(window.doc(window.db, "usuarios", user.uid));
            if (!userDoc.exists()) {
                await window.setDoc(window.doc(window.db, "usuarios", user.uid), {
                    username: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    fechaRegistro: new Date()
                });
            }
            
            loginMensaje.textContent = '¡Google Auth Exitoso! Entrando...';
            loginMensaje.style.color = '#4CAF50';
            setTimeout(() => { window.location.href = 'chat.html'; }, 1500);
        } catch (error) {
            loginMensaje.textContent = 'Error al iniciar con Google.';
            loginMensaje.style.color = '#f44336';
        }
    });

    // Recuperar Contraseña
    forgotPasswordBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        if (!email) {
            loginMensaje.textContent = 'Escribe tu correo arriba para enviar el link.';
            loginMensaje.style.color = '#ff9800';
            return;
        }
        try {
            await window.sendPasswordResetEmail(window.auth, email);
            loginMensaje.textContent = 'Correo de recuperación enviado. Revisa tu bandeja.';
            loginMensaje.style.color = '#4CAF50';
        } catch (error) {
            loginMensaje.textContent = 'Error al enviar el correo. Verifica que esté bien escrito.';
            loginMensaje.style.color = '#f44336';
        }
    });
});