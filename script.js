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

// Mostrar/Ocultar contraseñas
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', function() {
        const input = this.previousElementSibling;
        if(input.type === 'password') {
            input.type = 'text';
            this.classList.remove('fa-eye');
            this.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            this.classList.remove('fa-eye-slash');
            this.classList.add('fa-eye');
        }
    });
});

document.getElementById('registroForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = 'Procesando registro...';

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres.');
        btn.disabled = false; btn.textContent = 'Registrarme';
        return;
    }

    if (password !== confirmPassword) {
        showToast('Las contraseñas no coinciden. Por favor, verifícalas.');
        btn.disabled = false; btn.textContent = 'Registrarme';
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "usuarios", user.uid), {
            username: username, email: email, fechaRegistro: new Date()
        });

        showToast('¡Cuenta habilitada con éxito!', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);

    } catch (error) {
        if (error.code === 'auth/email-already-in-use') showToast('Este correo ya se encuentra en nuestra base de datos.');
        else showToast('Falla en el protocolo de registro. Inténtalo más tarde.');
        btn.disabled = false; btn.textContent = 'Registrarme';
    }
});