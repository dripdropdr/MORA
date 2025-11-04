// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const userIdInput = document.getElementById('user-id');
    const loginBtn = document.getElementById('login-btn');

    // Check if user is already logged in
    const currentUserId = getCurrentUserId();
    if (currentUserId) {
        // Redirect to start page if already logged in
        window.location.href = '/start';
        return;
    }

    loginForm.addEventListener('submit', handleLogin);
    
    // Focus on input field
    userIdInput.focus();
});

// Get current user ID from localStorage
function getCurrentUserId() {
    try {
        const userData = JSON.parse(localStorage.getItem('rp_user_data'));
        return userData ? userData.userId : null;
    } catch (e) {
        return null;
    }
}

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const userIdInput = document.getElementById('user-id');
    const loginBtn = document.getElementById('login-btn');
    const userId = userIdInput.value.trim();
    
    if (!userId) {
        showError('Please enter your ID.');
        return;
    }
    
    // Show loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading"></span> Logging in...';
    hideError();
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Save user data to localStorage
            const userData = {
                userId: userId,
                loginTime: new Date().toISOString(),
                stories: data.stories || {}
            };
            
            localStorage.setItem('rp_user_data', JSON.stringify(userData));
            
            showSuccess('Login successful! Redirecting...');
            
            // Redirect to start page
            setTimeout(() => {
                window.location.href = '/start';
            }, 1000);
            
        } else {
            showError(data.message || 'Login failed. Please try again.');
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showError('Connection error. Please try again.');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '🚪 Login';
    }
}

// Show error message
function showError(message) {
    hideError();
    const loginBox = document.querySelector('.login-box');
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message show';
    errorDiv.textContent = message;
    errorDiv.id = 'error-message';
    
    loginBox.appendChild(errorDiv);
    
    // Auto hide after 5 seconds
    setTimeout(hideError, 5000);
}

// Hide error message
function hideError() {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

// Show success message
function showSuccess(message) {
    hideSuccess();
    const loginBox = document.querySelector('.login-box');
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message show';
    successDiv.textContent = message;
    successDiv.id = 'success-message';
    
    loginBox.appendChild(successDiv);
}

// Hide success message
function hideSuccess() {
    const successMessage = document.getElementById('success-message');
    if (successMessage) {
        successMessage.remove();
    }
}

// Handle Enter key press
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        const loginBtn = document.getElementById('login-btn');
        if (!loginBtn.disabled) {
            loginBtn.click();
        }
    }
});

// Export functions for global access
window.getCurrentUserId = getCurrentUserId;
