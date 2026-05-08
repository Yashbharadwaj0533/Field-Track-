// auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Form switching
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignupBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    
    // Inputs
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const signupName = document.getElementById('signupName');
    const signupEmail = document.getElementById('signupEmail');
    const signupPassword = document.getElementById('signupPassword');
    
    // Buttons
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    
    // Message container
    const authMessage = document.getElementById('authMessage');

    // Toggle forms
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        clearMessage();
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        clearMessage();
    });

    function showMessage(msg, isError = false) {
        authMessage.textContent = msg;
        authMessage.style.color = isError ? 'var(--danger)' : 'var(--secondary)';
        authMessage.classList.remove('hidden');
    }

    function clearMessage() {
        authMessage.classList.add('hidden');
        authMessage.textContent = '';
    }

    // Login Logic
    loginBtn.addEventListener('click', async () => {
        const email = loginEmail.value.trim();
        const password = loginPassword.value;
        
        if (!email || !password) {
            showMessage('Please enter email and password.', true);
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';
        clearMessage();

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Fetch profile to redirect based on role
            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw profileError;

            if (profile.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'engineer.html';
            }

        } catch (error) {
            showMessage(error.message, true);
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket" style="margin-right: 0.5rem;"></i> Sign In';
        }
    });

    // Signup Logic (For Engineers Only)
    signupBtn.addEventListener('click', async () => {
        const name = signupName.value.trim();
        const email = signupEmail.value.trim();
        const password = signupPassword.value;

        if (!name || !email || !password) {
            showMessage('Please fill all fields.', true);
            return;
        }

        signupBtn.disabled = true;
        signupBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating...';
        clearMessage();

        try {
            // Register user in auth table
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
            });

            if (error) throw error;

            // Note: Since Supabase triggers aren't strictly defined in our basic schema, 
            // we will manually insert the profile here. (In production, a trigger is better).
            if (data.user) {
                const { error: profileError } = await supabaseClient
                    .from('profiles')
                    .insert([
                        { 
                            id: data.user.id, 
                            full_name: name,
                            role: 'engineer' // Sign up is only for engineers
                        }
                    ]);
                
                if (profileError) throw profileError;
            }

            showMessage('Account created! Please sign in.', false);
            
            // Switch to login
            setTimeout(() => {
                signupForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                loginEmail.value = email;
                loginPassword.value = '';
                signupBtn.disabled = false;
                signupBtn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 0.5rem;"></i> Create Account';
            }, 2000);

        } catch (error) {
            showMessage(error.message, true);
            signupBtn.disabled = false;
            signupBtn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right: 0.5rem;"></i> Create Account';
        }
    });

    // Auto redirect if already logged in
    async function checkExistingSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();
            
            if (profile) {
                window.location.href = profile.role === 'admin' ? 'admin.html' : 'engineer.html';
            }
        }
    }
    
    // Only check session if supabaseClient is defined
    if(typeof supabaseClient !== 'undefined') {
        checkExistingSession();
    } else {
        showMessage('Supabase is not configured. Please update config.js', true);
    }
});
