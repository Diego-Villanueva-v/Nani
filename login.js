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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Verificando...';
    
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
        showToast('Correo o contraseña incorrectos.');
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
                preferences: { color: "#d946ef" } 
            }, { merge: true });
        }
        const splash = document.getElementById('splashScreen');
        if(splash) {
            splash.style.display = 'flex';
            setTimeout(() => splash.style.opacity = '1', 50);
        }
        window.location.replace('chat.html');
    } catch (error) { showToast('Error al conectar con Google.'); }
});

document.getElementById('forgotPasswordBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) return showToast('Escribe tu correo arriba para recuperar la clave.', 'error');
    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Correo de recuperación enviado.', 'success');
    } catch (error) { showToast('Error. Revisa que el correo sea válido.'); }
});