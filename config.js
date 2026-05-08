// config.js

// TODO: Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://tgmxpawrrsxphsmsqfyz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnbXhwYXdycnN4cGhzbXNxZnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTM1MjksImV4cCI6MjA5MTk2OTUyOX0.lbNzIShVRTjkPNsFmH1pBGX6KuI2F7eR1qcKPcD6M3E';

// Initialize the Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check authentication state
async function checkAuth(requiredRole = null) {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (!session) {
        // Not logged in
        if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
        return null;
    }

    const user = session.user;

    // Fetch profile to get role
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        console.error("Profile not found for user.");
        return null;
    }

    if (requiredRole && profile.role !== requiredRole) {
        // Unauthorized for this page
        if (profile.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'engineer.html';
        }
    }

    return { session, user, profile };
}

// Logout function
async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

// Add logout listener to any button with id 'logoutBtn'
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
