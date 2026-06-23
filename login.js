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

const showToast = (msg, type = 'error') => {
    const toast = document.getElementById('toastNotification');
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => { toast.classList.remove('show'); }, 4000);
};

const hideSplash = () => {
    const splash = document.getElementById('splashScreen');
    if(splash) {
        splash.style.opacity = '0';
        setTimeout(() => splash.style.display = 'none', 500);
    }
    const loginBox = document.getElementById('loginContainer');
    if(loginBox) {
        loginBox.style.opacity = '1';
        loginBox.style.pointerEvents = 'all';
    }
};

window.addEventListener('load', () => { setTimeout(hideSplash, 3000); });

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.replace('chat.html');
    } else {
        setTimeout(hideSplash, 800);
    }
});

// Mostrar/Ocultar contraseña (El ojito)
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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Verificando credenciales...';
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('¡Acceso concedido!', 'success');
        
        const splash = document.getElementById('splashScreen');
        if(splash) {
            splash.style.display = 'flex';
            setTimeout(() => splash.style.opacity = '1', 50);
        }
        
        window.location.replace('chat.html');
    } catch (error) {
        showToast('Credenciales incorrectas o usuario no encontrado.');
        btn.disabled = false; btn.textContent = 'Iniciar Sesión';
    }
});

document.getElementById('googleLogin').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userDocRef = doc(db, "usuarios", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) {
            await setDoc(userDocRef, { 
                username: user.displayName || user.email.split('@')[0], 
                email: user.email,
                avatar: user.photoURL, 
                fechaRegistro: new Date(),
                preferences: { color: "#8b5cf6" } 
            }, { merge: true });
        }
        const splash = document.getElementById('splashScreen');
        if(splash) {
            splash.style.display = 'flex';
            setTimeout(() => splash.style.opacity = '1', 50);
        }
        window.location.replace('chat.html');
    } catch (error) { showToast('Error al establecer conexión con Google.'); }
});

// Lógica Modal de Recuperación
document.getElementById('forgotPasswordBtn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('recoveryModal').classList.add('active');
});

document.getElementById('cancelRecoveryBtn').addEventListener('click', () => {
    document.getElementById('recoveryModal').classList.remove('active');
    document.getElementById('recoveryEmailInput').value = '';
});

document.getElementById('sendRecoveryEmailBtn').addEventListener('click', async () => {
    const email = document.getElementById('recoveryEmailInput').value.trim();
    if (!email) return showToast('Por favor, ingresa una dirección de correo válida.', 'error');
    
    const btn = document.getElementById('sendRecoveryEmailBtn');
    btn.disabled = true;
    btn.textContent = 'Procesando...';

    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Enlace de seguridad emitido. Revisa tu bandeja de entrada.', 'success');
        setTimeout(() => {
            document.getElementById('recoveryModal').classList.remove('active');
            document.getElementById('recoveryEmailInput').value = '';
            btn.disabled = false;
            btn.textContent = 'Emitir Enlace';
        }, 2000);
    } catch (error) { 
        showToast('Falla en el protocolo. Verifica que el correo esté bien escrito.'); 
        btn.disabled = false;
        btn.textContent = 'Emitir Enlace';
    }
});