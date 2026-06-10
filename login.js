import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDEnq3hg0mNd69JymjHKc1fU7XInY6laDk",
    authDomain: "gen-lang-client-0867834675.firebaseapp.com",
    projectId: "gen-lang-client-0867834675",
    storageBucket: "gen-lang-client-0867834675.firebasestorage.app",
    messagingSenderId: "751363702976",
    appId: "1:751363702976:web:3568444232a9343a136d25"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
    // Si ya hay sesión iniciada, saltar directo al chat
    onAuthStateChanged(auth, (user) => { 
        if (user) window.location.href = 'chat.html'; 
    });

    const loginForm = document.getElementById('loginForm');
    const googleLoginBtn = document.getElementById('googleLogin');
    const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
    const loginMensaje = document.getElementById('loginMensaje');

    // --- Login Normal ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        const submitBtn = loginForm.querySelector('.btn-primary');
        submitBtn.textContent = 'Conectando...';
        submitBtn.disabled = true;
        loginMensaje.textContent = ''; // Limpiar errores anteriores

        try {
            await signInWithEmailAndPassword(auth, email, password);
            loginMensaje.textContent = '¡Acceso concedido!';
            loginMensaje.style.color = '#22c55e'; // Verde
            window.location.href = 'chat.html';
        } catch (error) {
            console.error("Auth Error:", error.code);
            // Mensaje estético en pantalla
            loginMensaje.textContent = "Correo o contraseña incorrectos.";
            loginMensaje.style.color = "var(--danger)";
            submitBtn.textContent = 'Iniciar Sesión';
            submitBtn.disabled = false;
        }
    });

    // --- Login con Google ---
    googleLoginBtn.addEventListener('click', async () => {
        loginMensaje.textContent = '';
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);

            if (!docSnap.exists()) {
                await setDoc(userDocRef, { 
                    username: user.displayName || user.email.split('@')[0], 
                    avatar: user.photoURL, 
                    preferences: { color: "#d946ef" } 
                }, { merge: true });
            }
            window.location.href = 'chat.html';
        } catch (error) { 
            console.error("Google Login Error:", error); 
            loginMensaje.textContent = "Error al autenticar con Google.";
            loginMensaje.style.color = "var(--danger)";
        }
    });

    // --- Recuperar Contraseña ---
    forgotPasswordBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        if (!email) {
            loginMensaje.textContent = 'Escribe tu correo arriba para enviar el link.';
            loginMensaje.style.color = "var(--accent)";
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            loginMensaje.textContent = 'Correo de recuperación enviado. Revisa tu bandeja.';
            loginMensaje.style.color = '#22c55e';
        } catch (error) {
            loginMensaje.textContent = 'Error al enviar. Verifica el correo.';
            loginMensaje.style.color = "var(--danger)";
        }
    });
});