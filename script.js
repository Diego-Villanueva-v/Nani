document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registroForm');
    const btnSubmit = document.getElementById('submitBtn');
    
    const inputs = {
        username: document.getElementById('username'),
        email: document.getElementById('email'),
        password: document.getElementById('password'),
        confirmPassword: document.getElementById('confirmPassword')
    };

    const errors = {
        username: document.getElementById('usernameError'),
        email: document.getElementById('emailError'),
        password: document.getElementById('passwordError'),
        confirmPassword: document.getElementById('confirmPasswordError')
    };

    const validState = { username: false, email: false, password: false, confirmPassword: false };

    const regex = {
        username: /^[a-zA-Z0-9]{6,}$/, 
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\S]{8,}$/ 
    };

    const setValid = (field) => {
        inputs[field].classList.remove('invalid');
        inputs[field].classList.add('valid');
        inputs[field].nextElementSibling.className = 'icon fas fa-check-circle valid-icon';
        validState[field] = true;
        checkFormValidity();
    };

    const setInvalid = (field, message) => {
        inputs[field].classList.remove('valid');
        inputs[field].classList.add('invalid');
        inputs[field].nextElementSibling.className = 'icon fas fa-times-circle invalid-icon';
        errors[field].textContent = message;
        validState[field] = false;
        checkFormValidity();
    };

    inputs.username.addEventListener('input', () => {
        errors.username.textContent = '';
        !regex.username.test(inputs.username.value) ? setInvalid('username', 'Mínimo 6 caracteres sin símbolos.') : setValid('username');
    });

    inputs.email.addEventListener('input', () => {
        errors.email.textContent = '';
        !regex.email.test(inputs.email.value) ? setInvalid('email', 'Ingrese un correo válido.') : setValid('email');
    });

    inputs.password.addEventListener('input', () => {
        errors.password.textContent = '';
        !regex.password.test(inputs.password.value) ? setInvalid('password', 'Mín 8 carac., 1 mayúscula, 1 minúscula, 1 número.') : setValid('password');
        if (inputs.confirmPassword.value.length > 0) validateConfirmPassword();
    });

    const validateConfirmPassword = () => {
        errors.confirmPassword.textContent = '';
        (inputs.confirmPassword.value !== inputs.password.value || inputs.confirmPassword.value === '') ? setInvalid('confirmPassword', 'Las contraseñas no coinciden.') : setValid('confirmPassword');
    };
    
    inputs.confirmPassword.addEventListener('input', validateConfirmPassword);

    const checkFormValidity = () => {
        btnSubmit.disabled = !(validState.username && validState.email && validState.password && validState.confirmPassword);
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!btnSubmit.disabled) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Creando cuenta...';
            const mensajeFinal = document.getElementById('mensajeFinal');

            try {
                const userCredential = await window.createUserWithEmailAndPassword(window.auth, inputs.email.value, inputs.password.value);
                const user = userCredential.user;

                await window.setDoc(window.doc(window.db, "usuarios", user.uid), {
                    username: inputs.username.value,
                    email: inputs.email.value,
                    fechaRegistro: new Date()
                });

                mensajeFinal.textContent = '¡Cuenta creada! Redirigiendo al login...';
                mensajeFinal.style.color = '#238636';
                form.reset();
                setTimeout(() => { window.location.href = 'index.html'; }, 2000);

            } catch (error) {
                console.error("Error al registrar: ", error);
                
                if (error.code === 'auth/email-already-in-use') {
                    mensajeFinal.textContent = 'Este correo ya está registrado. Inicia sesión.';
                } else if (error.code === 'auth/invalid-email') {
                    mensajeFinal.textContent = 'Formato de correo inválido.';
                } else {
                    mensajeFinal.textContent = 'Hubo un error al registrar. Intenta de nuevo.';
                }
                mensajeFinal.style.color = '#f85149';
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Crear mi cuenta';
            }
        }
    });
});