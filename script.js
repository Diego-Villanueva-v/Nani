import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const showToast = (msg, type = 'error') => {
    const toast = document.getElementById('toastNotification');
    toast.textContent = msg; toast.className = `toast show ${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 4000);
};

document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Creando...';

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres.');
        btn.disabled = false; btn.textContent = 'Registrarme';
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "usuarios", user.uid), {
            username: username, email: email, fechaRegistro: new Date()
        });

        showToast('¡Cuenta creada con éxito!', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') showToast('Este correo ya está registrado.');
        else showToast('Hubo un error al registrar. Intenta de nuevo.');
        btn.disabled = false; btn.textContent = 'Registrarme';
    }
});