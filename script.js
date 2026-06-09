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

    const validState = {
        username: false,
        email: false,
        password: false,
        confirmPassword: false
    };

    const regex = {
        username: /^[a-zA-Z0-9]{6,}$/, 
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\S]{8,}$/ 
    };

    const setValid = (field) => {
        inputs[field].classList.remove('invalid');
        inputs[field].classList.add('valid');
        const icon = inputs[field].nextElementSibling;
        icon.className = 'icon fas fa-check-circle valid-icon';
        validState[field] = true;
        checkFormValidity();
    };

    const setInvalid = (field, message) => {
        inputs[field].classList.remove('valid');
        inputs[field].classList.add('invalid');
        const icon = inputs[field].nextElementSibling;
        icon.className = 'icon fas fa-times-circle invalid-icon';
        errors[field].textContent = message;
        validState[field] = false;
        checkFormValidity();
    };

    inputs.username.addEventListener('input', () => {
        errors.username.textContent = '';
        if (!regex.username.test(inputs.username.value)) {
            setInvalid('username', 'Debe tener al menos 6 caracteres y sin símbolos.');
        } else {
            setValid('username');
        }
    });

    inputs.email.addEventListener('input', () => {
        errors.email.textContent = '';
        if (!regex.email.test(inputs.email.value)) {
            setInvalid('email', 'Ingrese un correo electrónico válido.');
        } else {
            setValid('email');
        }
    });

    inputs.password.addEventListener('input', () => {
        errors.password.textContent = '';
        if (!regex.password.test(inputs.password.value)) {
            setInvalid('password', 'Mínimo 8 caracteres, 1 mayúscula, 1 minúscula y 1 número.');
        } else {
            setValid('password');
        }
        if (inputs.confirmPassword.value.length > 0) {
            validateConfirmPassword();
        }
    });

    const validateConfirmPassword = () => {
        errors.confirmPassword.textContent = '';
        if (inputs.confirmPassword.value !== inputs.password.value || inputs.confirmPassword.value === '') {
            setInvalid('confirmPassword', 'Las contraseñas no coinciden.');
        } else {
            setValid('confirmPassword');
        }
    };
    
    inputs.confirmPassword.addEventListener('input', validateConfirmPassword);

    const checkFormValidity = () => {
        if (validState.username && validState.email && validState.password && validState.confirmPassword) {
            btnSubmit.disabled = false;
        } else {
            btnSubmit.disabled = true;
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!btnSubmit.disabled) {
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Registrando...';

            try {
                const userCredential = await window.createUserWithEmailAndPassword(
                    window.auth, 
                    inputs.email.value, 
                    inputs.password.value
                );
                
                const user = userCredential.user;

                await window.setDoc(window.doc(window.db, "usuarios", user.uid), {
                    username: inputs.username.value,
                    email: inputs.email.value,
                    fechaRegistro: new Date()
                });

                document.getElementById('mensajeFinal').textContent = '¡Registro exitoso! Ya puedes iniciar sesión.';
                document.getElementById('mensajeFinal').style.color = 'green';
                form.reset();
                
                Object.keys(inputs).forEach(key => {
                    inputs[key].classList.remove('valid', 'invalid');
                    inputs[key].nextElementSibling.className = 'icon fas';
                    errors[key].textContent = '';
                    validState[key] = false;
                });

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);

            } catch (error) {
                console.error("Error al registrar: ", error);
                document.getElementById('mensajeFinal').textContent = 'El correo ya está en uso o hubo un error.';
                document.getElementById('mensajeFinal').style.color = 'red';
                btnSubmit.disabled = false;
            } finally {
                if(btnSubmit.disabled) {
                    btnSubmit.textContent = 'Registrarse';
                }
            }
        }
    });
});