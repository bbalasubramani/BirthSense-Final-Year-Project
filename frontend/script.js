// ✅ script.js — fixed JWT/session issue (includes credentials everywhere)

// --- API UTILITIES (for communication with Express Backend) ---
const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Universal API function.
 * Automatically sends/receives JWT cookies for authentication.
 * Handles 401/403 and redirects to login if session expired.
 */

async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      console.warn('Session expired — redirecting to login...');
      window.location.href = 'login.html';
      return null;
    }

    if (!response.ok) throw new Error(data.message || 'API Error');
    return data;
  } catch (err) {
    console.error(`API Error @ ${endpoint}:`, err.message);
    const msg = document.getElementById('statusMessage');
    if (msg) {
      msg.textContent = `Error: ${err.message}`;
      msg.style.color = 'red';
    }
    throw err;
  }
}

/**
 * ✅ Dedicated login function with credentials included.
 * Example use: login.html → handleLogin()
 */
async function handleLogin(email, password) {
    try {
        const data = await apiCall('/auth/login', 'POST', { email, password });
        if (data && data._id) {
            // Redirect after successful login
            window.location.href = 'index.html';
        }
    } catch (err) {
        const msg = document.getElementById('statusMessage');
        if (msg) {
            msg.textContent = 'Invalid email or password.';
            msg.style.color = 'red';
        }
    }
}

/**
 * ✅ Dedicated signup function with credentials included.
 */
async function handleSignup(name, email, password, role) {
    try {
        await apiCall('/auth/signup', 'POST', { name, email, password, role });
        window.location.href = 'login.html';
    } catch (err) {
        const msg = document.getElementById('statusMessage');
        if (msg) {
            msg.textContent = err.message || 'Signup failed.';
            msg.style.color = 'red';
        }
    }
}

/**
 * ✅ Universal Logout — clears JWT cookie on server and redirects.
 */
async function handleLogout() {
    try {
        await apiCall('/auth/logout', 'POST');
    } catch (err) {
        console.warn('Logout request failed:', err.message);
    } finally {
        window.location.href = 'index.html';
    }
}

// --- DASHBOARD UI LOGIC ---
function setupDashboardNavigation() {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('.sidebar-nav .nav-item')
                .forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            const target = this.getAttribute('data-target');
            document.querySelectorAll('.content-section')
                .forEach(sec => sec.classList.remove('active'));
            document.getElementById(target)?.classList.add('active');
        });
    });
}

// --- FORM LOGIC: BMI Calculation ---
function calculateBMI() {
    const heightEl = document.getElementById("height");
    const weightEl = document.getElementById("weight");
    const bmiEl = document.getElementById("bmi");

    const height = parseFloat(heightEl?.value);
    const weight = parseFloat(weightEl?.value);

    if (height > 0 && weight > 0 && bmiEl) {
        const bmi = (weight / ((height / 100) ** 2)).toFixed(1);
        bmiEl.value = bmi;
    } else if (bmiEl) {
        bmiEl.value = "";
    }

    validateField("height");
    validateField("weight");
    validateField("bmi");
}

// --- VALIDATION RULES ---
const validationRules = {
    patientId: { required: true, msg: "Patient ID is required." },
    patientName: { required: true, msg: "Patient Name is required." },
    age: { min: 15, max: 50, msg: "Maternal Age should be between 15 and 50 years." },
    height: { min: 100, max: 250, msg: "Height should be between 100 and 250 cm." },
    weight: { min: 30, max: 200, msg: "Weight should be between 30 and 200 kg." },
    bmi: { min: 15, max: 40, msg: "BMI should be between 15 and 40." },
    gravidity: { min: 0, max: 20, msg: "Gravidity should be between 0 and 20." },
    parity: { min: 0, max: 15, msg: "Parity should be between 0 and 15." },
    gestational_age: { min: 1, max: 42, msg: "Gestational Age should be between 1 and 42 weeks." },
    estimated_fetal_weight: { min: 500, max: 6000, msg: "Fetal Weight should be between 500 g and 6000 g." },
    amniotic_fluid_index: { min: 5, max: 25, msg: "AFI should be between 5 and 25 cm." },
    bishop_score: { min: 0, max: 13, msg: "Bishop Score should be between 0 and 13." },
    bp_systolic: { min: 80, max: 200, msg: "Systolic BP should be between 80 and 200 mmHg." },
    bp_diastolic: { min: 40, max: 120, msg: "Diastolic BP should be between 40 and 120 mmHg." },
    previous_cesarean: { required: true },
    gestational_diabetes: { required: true },
};

// --- VALIDATION FUNCTION ---
function validateField(id) {
    const el = document.getElementById(id);
    if (!el) return true;

    const tick = document.getElementById(`tick-${id}`);
    const warning = document.getElementById(`warning-${id}`);
    const rule = validationRules[id];
    if (!rule) return true;

    const value = el.value.trim();
    const numValue = parseFloat(value);
    let isValid = true;
    let msg = '';

    if (rule.required && value === '') {
        isValid = false;
        msg = rule.msg || 'This field is required.';
    } else if (!isNaN(numValue) &&
        ((rule.min && numValue < rule.min) || (rule.max && numValue > rule.max))) {
        isValid = false;
        msg = rule.msg;
    }

    if (isValid) {
        tick?.classList.add('show');
        if (warning) warning.style.display = 'none';
    } else {
        tick?.classList.remove('show');
        if (warning) {
            warning.textContent = msg;
            warning.style.display = 'block';
        }
    }

    return isValid;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupDashboardNavigation();
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    document.querySelectorAll('.form-grid input, .form-grid select').forEach(input => {
        if (input.id === 'height' || input.id === 'weight') {
            input.addEventListener('input', calculateBMI);
        } else {
            input.addEventListener('input', () => validateField(input.id));
            input.addEventListener('change', () => validateField(input.id));
        }
        validateField(input.id);
    });

    if (document.getElementById('height') && document.getElementById('weight')) calculateBMI();

    const predictBtn = document.getElementById('predictBtn');
    const submitDataBtn = document.getElementById('submitDataBtn');
    const formButton = predictBtn || submitDataBtn;

    if (formButton) {
        formButton.addEventListener('click', (e) => {
            e.preventDefault();
            let isValid = true;
            document.querySelectorAll('.form-grid input, .form-grid select').forEach(inp => {
                if (!validateField(inp.id)) isValid = false;
            });

            if (!isValid) {
                const msg = document.getElementById('statusMessage');
                if (msg) {
                    msg.textContent = 'Please correct highlighted errors before continuing.';
                    msg.style.color = 'red';
                }
                const firstInvalid = document.querySelector('.warning-message[style*="block"]');
                if (firstInvalid) {
                    const sectionId = firstInvalid.closest('.content-section')?.id;
                    if (sectionId) {
                        document.querySelector(`.nav-item[data-target="${sectionId}"]`)?.click();
                    }
                    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                e.stopImmediatePropagation();
            }
        });
    }
});

// --- GLOBAL EXPORTS ---
window.apiCall = apiCall;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.calculateBMI = calculateBMI;
window.validateField = validateField;
window.validationRules = validationRules;
