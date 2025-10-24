// ==============================
// SafeHer Web - Main JavaScript
// ==============================

// --- DOM Elements ---
const sosButton = document.getElementById('sosButton');
const settingsBtn = document.getElementById('settingsBtn');
const addContactBtn = document.getElementById('addContactBtn');

const statusDisplay = document.getElementById('statusDisplay');
const contactList = document.getElementById('contactList');
const countdownTimer = document.querySelector('.countdown-timer');

// --- Modals ---
const settingsModal = document.getElementById('settingsModal');
const contactModal = document.getElementById('contactModal');
const alertConfirmationModal = document.getElementById('alertConfirmationModal');
const fakeCallModal = document.getElementById('fakeCallModal');

// --- Modal Close Buttons ---
document.querySelectorAll('.modal .close-button').forEach(button => {
    button.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
    });
});

// --- Settings Modal Elements ---
const voiceActivationToggle = document.getElementById('voiceActivationToggle');
const fakeCallToggle = document.getElementById('fakeCallToggle');
const triggerFakeCallBtn = document.getElementById('triggerFakeCallBtn');
const testModeToggle = document.getElementById('testModeToggle');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// --- Contact Modal Elements ---
const contactModalTitle = document.getElementById('contactModalTitle');
const contactForm = document.getElementById('contactForm');
const contactNameInput = document.getElementById('contactName');
const contactMethodInput = document.getElementById('contactMethod');
const contactValueInput = document.getElementById('contactValue');
const contactValueLabel = document.getElementById('contactValueLabel');

// --- Alert Confirmation Modal Elements ---
const alertCountdownDisplay = document.getElementById('alertCountdown');
const cancelAlertBtn = document.getElementById('cancelAlertBtn');

// --- Fake Call Modal Elements ---
const fakeCallerName = document.getElementById('fakeCallerName');
const fakeCallerNumber = document.getElementById('fakeCallerNumber');
const declineCallBtn = document.getElementById('declineCallBtn');
const acceptCallBtn = document.getElementById('acceptCallBtn');

// --- Global Variables ---
let currentGeolocation = null;
let sosCountdown = 5;
let sosInterval = null;
let currentAlertTimeout = null;
let contacts = JSON.parse(localStorage.getItem('safeher_contacts')) || [];
let settings = JSON.parse(localStorage.getItem('safeher_settings')) || {
    voiceActivation: false,
    fakeCall: false,
    testMode: false
};
let isVoiceListening = false;
let speechRecognition = null;
let editingContactId = null;
let fakeCallAudio = null;

// ==============================
// Utility Functions
// ==============================
function showModal(modalElement) {
    modalElement.style.display = 'flex';
}

function hideModal(modalElement) {
    modalElement.style.display = 'none';
}

function updateStatus(message, type = 'info') {
    const icon =
        type === 'error'
            ? 'exclamation'
            : type === 'success'
            ? 'check'
            : 'info';
    statusDisplay.innerHTML = `<i class="fas fa-circle-${icon}"></i> ${message}`;
    statusDisplay.className = `status-message ${type}`;
}

// ==============================
// Geolocation
// ==============================
// ==============================
// Geolocation (Improved with fallback)
// ==============================
function getGeolocation() {
    if (!navigator.geolocation) {
        updateStatus("Geolocation not supported by your browser.", 'error');
        currentGeolocation = { latitude: 28.6139, longitude: 77.2090 }; // New Delhi fallback
        return;
    }

    updateStatus("Fetching location...", 'info');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentGeolocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            updateStatus(`Location acquired (±${currentGeolocation.accuracy.toFixed(0)}m).`, 'success');
        },
        (error) => {
            let reason = "";
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    reason = "Permission denied. Using fallback location (New Delhi).";
                    break;
                case error.POSITION_UNAVAILABLE:
                    reason = "Position unavailable. Using fallback location (New Delhi).";
                    break;
                case error.TIMEOUT:
                    reason = "Location request timed out. Using fallback location (New Delhi).";
                    break;
                default:
                    reason = error.message || "Unknown error. Using fallback location (New Delhi).";
            }

            currentGeolocation = { latitude: 28.6139, longitude: 77.2090 };
            updateStatus(reason, 'warning');
        },
        { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
}


function generateGoogleMapsLink(latitude, longitude) {
    return latitude && longitude
        ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
        : "Location unavailable.";
}

// ==============================
// Contact Management
// ==============================
function saveContacts() {
    localStorage.setItem('safeher_contacts', JSON.stringify(contacts));
    renderContacts();
}

function renderContacts() {
    contactList.innerHTML = '';
    if (contacts.length === 0) {
        contactList.innerHTML =
            '<p class="note">No emergency contacts added yet. Click "Add New Contact" to get started.</p>';
        return;
    }

    contacts.forEach((contact, index) => {
        const contactItem = document.createElement('div');
        contactItem.className = 'contact-item';
        contactItem.innerHTML = `
            <div class="contact-info">
                <h3>${contact.name}</h3>
                <p>${contact.method.toUpperCase()}: ${contact.value}</p>
            </div>
            <div class="contact-actions">
                <button data-id="${index}" class="edit-contact-btn"><i class="fas fa-edit"></i></button>
                <button data-id="${index}" class="delete-contact-btn"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        contactList.appendChild(contactItem);
    });

    document.querySelectorAll('.edit-contact-btn').forEach(btn =>
        btn.addEventListener('click', e => editContact(parseInt(e.currentTarget.dataset.id)))
    );
    document.querySelectorAll('.delete-contact-btn').forEach(btn =>
        btn.addEventListener('click', e => deleteContact(parseInt(e.currentTarget.dataset.id)))
    );
}

function addOrUpdateContact(event) {
    event.preventDefault();
    const name = contactNameInput.value.trim();
    const method = contactMethodInput.value;
    const value = contactValueInput.value.trim();

    if (!name || !value) {
        updateStatus("Name and contact value cannot be empty.", 'error');
        return;
    }

    if (editingContactId !== null) {
        contacts[editingContactId] = { name, method, value };
        updateStatus("Contact updated successfully!", 'success');
    } else {
        contacts.push({ name, method, value });
        updateStatus("Contact added successfully!", 'success');
    }

    saveContacts();
    hideModal(contactModal);
    contactForm.reset();
    editingContactId = null;
}

function editContact(id) {
    const contact = contacts[id];
    if (!contact) return;

    editingContactId = id;
    contactModalTitle.textContent = "Edit Contact";
    contactNameInput.value = contact.name;
    contactMethodInput.value = contact.method;
    contactValueInput.value = contact.value;
    updateContactLabel();
    showModal(contactModal);
}

function deleteContact(id) {
    if (confirm(`Delete ${contacts[id].name}?`)) {
        contacts.splice(id, 1);
        saveContacts();
        updateStatus("Contact deleted.", 'info');
    }
}

function updateContactLabel() {
    const method = contactMethodInput.value;
    if (method === 'whatsapp') {
        contactValueLabel.textContent = 'WhatsApp Number:';
        contactValueInput.placeholder = '+1234567890';
    } else if (method === 'email') {
        contactValueLabel.textContent = 'Email Address:';
        contactValueInput.placeholder = 'example@email.com';
    } else if (method === 'sms') {
        contactValueLabel.textContent = 'SMS Number:';
        contactValueInput.placeholder = '+1234567890';
    }
}

// ==============================
// Settings Management
// ==============================
function saveSettings() {
    localStorage.setItem('safeher_settings', JSON.stringify(settings));
    applySettings();
    updateStatus("Settings saved.", 'success');
    hideModal(settingsModal);
}

function loadSettings() {
    voiceActivationToggle.checked = settings.voiceActivation;
    fakeCallToggle.checked = settings.fakeCall;
    testModeToggle.checked = settings.testMode;
    triggerFakeCallBtn.style.display = settings.fakeCall ? 'block' : 'none';
    applySettings();
}

function applySettings() {
    if (settings.voiceActivation && !isVoiceListening) {
        startVoiceRecognition();
    } else if (!settings.voiceActivation && isVoiceListening) {
        stopVoiceRecognition();
    }
    triggerFakeCallBtn.style.display = settings.fakeCall ? 'block' : 'none';

    if (settings.testMode) {
        sosButton.classList.add('test-mode');
        updateStatus("TEST MODE ACTIVE: Alerts will simulate sending.", 'info');
    } else {
        sosButton.classList.remove('test-mode');
        updateStatus("Ready. Add contacts and enable features.", 'info');
    }
}

// ==============================
// Voice Activation
// ==============================
function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        updateStatus("Voice activation not supported by your browser.", 'error');
        settings.voiceActivation = false;
        voiceActivationToggle.checked = false;
        saveSettings();
        return;
    }

    if (speechRecognition) speechRecognition.stop();

    speechRecognition = new webkitSpeechRecognition();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = false;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
        isVoiceListening = true;
        updateStatus("Voice activation enabled. Listening for 'Help Me'...", 'info');
    };

    speechRecognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        if (transcript.includes('help me')) {
            updateStatus("Voice command detected! Initiating SOS...", 'error');
            triggerSOS();
        }
    };

    speechRecognition.onerror = (event) => {
        console.error("Speech error:", event.error);
        updateStatus(`Voice error: ${event.error}`, 'error');
        isVoiceListening = false;
        settings.voiceActivation = false;
        voiceActivationToggle.checked = false;
    };

    speechRecognition.onend = () => {
        isVoiceListening = false;
        if (settings.voiceActivation) setTimeout(startVoiceRecognition, 500);
    };

    try {
        speechRecognition.start();
    } catch (e) {
        updateStatus("Voice activation failed. Check microphone permissions.", 'error');
    }
}

function stopVoiceRecognition() {
    if (speechRecognition && isVoiceListening) {
        speechRecognition.stop();
        speechRecognition = null;
        isVoiceListening = false;
        updateStatus("Voice activation disabled.", 'info');
    }
}

// ==============================
// SOS Alert Logic
// ==============================
function triggerSOS() {
    if (sosInterval) return;

    if (!currentGeolocation) {
        updateStatus("No location available. Please enable or wait for GPS.", 'error');
        getGeolocation();
        return;
    }

    showModal(alertConfirmationModal);
    sosButton.classList.add('active');
    sosCountdown = 5;
    alertCountdownDisplay.textContent = sosCountdown;

    sosInterval = setInterval(() => {
        sosCountdown--;
        alertCountdownDisplay.textContent = sosCountdown;

        if (sosCountdown <= 0) {
            clearInterval(sosInterval);
            sosInterval = null;
            sendAlerts();
            hideModal(alertConfirmationModal);
            sosButton.classList.remove('active');
        }
    }, 1000);
}

function cancelSOS() {
    if (sosInterval) clearInterval(sosInterval);
    if (currentAlertTimeout) clearTimeout(currentAlertTimeout);
    hideModal(alertConfirmationModal);
    sosButton.classList.remove('active');
    updateStatus("SOS alert cancelled.", 'info');
}

function sendAlerts() {
    const isTestMode = settings.testMode;
    const locationLink = currentGeolocation
        ? generateGoogleMapsLink(currentGeolocation.latitude, currentGeolocation.longitude)
        : "Location unavailable.";
    const alertMessage = `URGENT! ${isTestMode ? '[TEST MODE] ' : ''}SafeHer alert! I need help. My last known location is: ${locationLink}.`;

    if (contacts.length === 0) {
        updateStatus(isTestMode ? "TEST MODE: No contacts to simulate alert for." : "No contacts added.", 'error');
        return;
    }

    updateStatus(isTestMode ? "Simulating alerts..." : "Sending alerts...", 'error');

    contacts.forEach(contact => {
        if (isTestMode) {
            console.log(`[TEST] Would send: "${alertMessage}" to ${contact.name} (${contact.method}: ${contact.value})`);
            return;
        }

        switch (contact.method) {
            case 'whatsapp':
                window.open(`https://api.whatsapp.com/send?phone=${contact.value}&text=${encodeURIComponent(alertMessage)}`, '_blank');
                break;
            case 'email':
                window.open(`mailto:${contact.value}?subject=${encodeURIComponent('SafeHer Alert!')}&body=${encodeURIComponent(alertMessage)}`, '_blank');
                break;
            case 'sms':
                updateStatus(`Simulated SMS sent to ${contact.name}.`, 'info');
                break;
        }
    });

    updateStatus(isTestMode ? "TEST MODE: Alerts simulated." : "Alerts sent successfully!", 'success');
}

// ==============================
// Fake Call Feature
// ==============================
function triggerFakeCall() {
    if (!settings.fakeCall) {
        updateStatus("Fake call feature not enabled.", 'error');
        return;
    }

    fakeCallerName.textContent = "Emergency Contact";
    fakeCallerNumber.textContent = "123-456-7890";
    showModal(fakeCallModal);

    if (fakeCallAudio) {
        fakeCallAudio.pause();
        fakeCallAudio.currentTime = 0;
    }

    fakeCallAudio = new Audio('https://www.soundjay.com/phone/sounds/phone-ring-01.mp3');
    fakeCallAudio.loop = true;
    fakeCallAudio.play().catch(e => console.error("Audio error:", e));
}

function handleFakeCallAccept() {
    if (fakeCallAudio) fakeCallAudio.pause();
    hideModal(fakeCallModal);
    updateStatus("Fake call accepted.", 'info');
    setTimeout(() => updateStatus("Fake call ended.", 'success'), 5000);
}

function handleFakeCallDecline() {
    if (fakeCallAudio) fakeCallAudio.pause();
    hideModal(fakeCallModal);
    updateStatus("Fake call declined.", 'info');
}

// ==============================
// Event Listeners
// ==============================
sosButton.addEventListener('click', triggerSOS);
settingsBtn.addEventListener('click', () => { loadSettings(); showModal(settingsModal); });
saveSettingsBtn.addEventListener('click', () => {
    settings.voiceActivation = voiceActivationToggle.checked;
    settings.fakeCall = fakeCallToggle.checked;
    settings.testMode = testModeToggle.checked;
    saveSettings();
});
fakeCallToggle.addEventListener('change', () => {
    triggerFakeCallBtn.style.display = fakeCallToggle.checked ? 'block' : 'none';
});
triggerFakeCallBtn.addEventListener('click', triggerFakeCall);
addContactBtn.addEventListener('click', () => {
    editingContactId = null;
    contactModalTitle.textContent = "Add New Contact";
    contactForm.reset();
    updateContactLabel();
    showModal(contactModal);
});
contactForm.addEventListener('submit', addOrUpdateContact);
contactMethodInput.addEventListener('change', updateContactLabel);
cancelAlertBtn.addEventListener('click', cancelSOS);
declineCallBtn.addEventListener('click', handleFakeCallDecline);
acceptCallBtn.addEventListener('click', handleFakeCallAccept);

// ==============================
// Initialization
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    getGeolocation();
    loadSettings();
    renderContacts();
});

