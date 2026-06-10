document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const loginMensaje = document.getElementById('loginMensaje');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verificando...';
        loginMensaje.textContent = '';

        // Trim para evitar que espacios accidentales rompan el login
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            await window.signInWithEmailAndPassword(window.auth, email, password);
            loginMensaje.textContent = '¡Acceso concedido! Redirigiendo...';
            loginMensaje.style.color = '#22c55e';
            setTimeout(() => { window.location.href = 'chat.html'; }, 1000);
        } catch (error) {
            console.error("Error al iniciar sesión:", error);
            loginMensaje.style.color = '#ef4444';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                loginMensaje.textContent = 'Correo o contraseña incorrectos.';
            } else {
                loginMensaje.textContent = 'Error de conexión con el sistema.';
            }
            loginBtn.disabled = false;
            loginBtn.textContent = 'Ingresar al sistema';
        }
    });

    googleLoginBtn.addEventListener('click', async () => {
        const provider = new window.GoogleAuthProvider();
        loginMensaje.textContent = '';
        try {
            const result = await window.signInWithPopup(window.auth, provider);
            const user = result.user;
            
            const userDoc = await window.getDoc(window.doc(window.db, "usuarios", user.uid));
            if (!userDoc.exists()) {
                await window.setDoc(window.doc(window.db, "usuarios", user.uid), {
                    username: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    fechaRegistro: new Date()
                });
            }
            
            loginMensaje.textContent = '¡Google Auth Exitoso! Entrando...';
            loginMensaje.style.color = '#22c55e';
            setTimeout(() => { window.location.href = 'chat.html'; }, 1000);
        } catch (error) {
            loginMensaje.textContent = 'Error al iniciar con Google.';
            loginMensaje.style.color = '#ef4444';
        }
    });

    forgotPasswordBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) {
            loginMensaje.textContent = 'Escribe tu correo arriba para enviar el link de recuperación.';
            loginMensaje.style.color = '#fbbf24';
            return;
        }
        try {
            await window.sendPasswordResetEmail(window.auth, email);
            loginMensaje.textContent = 'Correo de recuperación enviado. Revisa tu bandeja.';
            loginMensaje.style.color = '#22c55e';
        } catch (error) {
            loginMensaje.textContent = 'Error al enviar. Verifica el correo electrónico.';
            loginMensaje.style.color = '#ef4444';
        }
    });
});