document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const loginMensaje = document.getElementById('loginMensaje');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verificando...';

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const userCredential = await window.signInWithEmailAndPassword(window.auth, email, password);
            
            loginMensaje.textContent = '¡Inicio de sesión exitoso! Redirigiendo...';
            loginMensaje.style.color = 'green';
            
            // Redirección a la aplicación de chat (Actividad 3.3)
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1500);

        } catch (error) {
            console.error(error);
            loginMensaje.textContent = 'Credenciales incorrectas o usuario no registrado.';
            loginMensaje.style.color = 'red';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Ingresar';
        }
    });
});