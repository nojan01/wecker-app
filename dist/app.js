/**
 * Wecker-App - Hauptanwendung
 * Verwaltet die Digitaluhr-Anzeige und koordiniert alle Module
 */

// Tauri API
let tauriWindow = null;
let tauriInvoke = null;
if (window.__TAURI__) {
    tauriWindow = window.__TAURI__.window;
    tauriInvoke = window.__TAURI__.core.invoke;
}

// Power Management Status
let preventSleepEnabled = false;

// DOM-Elemente - werden in init() initialisiert
let hour1El, hour2El, min1El, min2El, amIndicator, pmIndicator, weekdayItems;
let nextAlarmText, settingsBtn;
let alarmsListEl, addAlarmBtn;
let alarmModal, alarmForm, closeModalBtn, deleteAlarmBtn, modalTitle;
let alarmNotification, alarmDisplayTime, alarmDisplayLabel, snoozeBtn, dismissBtn;

// Wochentage Mapping
const WEEKDAYS_MAP = {
    0: 'so', 1: 'mo', 2: 'di', 3: 'mi', 4: 'do', 5: 'fr', 6: 'sa'
};

const WEEKDAY_NAMES = {
    'so': 'Sunday', 'mo': 'Monday', 'di': 'Tuesday', 
    'mi': 'Wednesday', 'do': 'Thursday', 'fr': 'Friday', 'sa': 'Saturday'
};

// Aktueller Bearbeitungsmodus
let editingAlarmId = null;
let currentlyRingingAlarm = null;
let use24HourFormat = true; // 24-Stunden-Format

// Sleep Mode Einstellungen
let sleepModeSettings = {
    enabled: false,
    brightness: 20,
    autoStartTime: '22:00',
    autoEndTime: '06:00',
    isActive: false
};

/**
 * Uhrzeit aktualisieren
 */
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    
    // AM/PM berechnen
    const isPM = hours >= 12;
    
    if (!use24HourFormat) {
        hours = hours % 12 || 12;
    }
    
    // Digits aktualisieren
    const hourStr = String(hours).padStart(2, '0');
    const minStr = String(minutes).padStart(2, '0');
    
    hour1El.textContent = hourStr[0];
    hour2El.textContent = hourStr[1];
    min1El.textContent = minStr[0];
    min2El.textContent = minStr[1];
    
    // AM/PM aktualisieren und Anzeige ein-/ausblenden
    const ampmIndicator = document.querySelector('.ampm-indicator');
    if (use24HourFormat) {
        ampmIndicator.classList.remove('visible');
        amIndicator.classList.remove('active');
        pmIndicator.classList.remove('active');
    } else {
        ampmIndicator.classList.add('visible');
        amIndicator.classList.toggle('active', !isPM);
        pmIndicator.classList.toggle('active', isPM);
    }
    
    // Aktuellen Wochentag markieren
    const currentDay = WEEKDAYS_MAP[now.getDay()];
    weekdayItems.forEach(item => {
        item.classList.toggle('active', item.dataset.day === currentDay);
    });
    
    // Alarme prüfen
    checkAlarms(now);
}

/**
 * Alarme prüfen
 */
function checkAlarms(now) {
    if (currentlyRingingAlarm) return;
    
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = WEEKDAYS_MAP[now.getDay()];
    
    const alarms = AlarmManager.getAlarms();
    
    for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        if (alarm.time !== currentTime) continue;
        if (!alarm.days.includes(currentDay)) continue;
        
        // Nur in der ersten Sekunde der Minute auslösen
        if (now.getSeconds() === 0) {
            triggerAlarm(alarm);
            break;
        }
    }
}

/**
 * Alarm auslösen
 */
function triggerAlarm(alarm) {
    currentlyRingingAlarm = alarm;
    
    // UI aktualisieren
    alarmDisplayTime.textContent = alarm.time;
    alarmDisplayLabel.textContent = alarm.label || 'Alarm';
    alarmNotification.classList.remove('hidden');
    
    // Snooze-Button anzeigen/verstecken
    snoozeBtn.style.display = alarm.snooze?.enabled ? 'block' : 'none';
    
    // Sound abspielen
    const fadeEnabled = alarm.fadeEnabled !== false;
    AudioPlayer.playAlarm(alarm.sound || 'gentle-rise', {
        startVolume: fadeEnabled ? 0.1 : (alarm.volume || 0.7),
        endVolume: alarm.volume || 1.0,
        duration: fadeEnabled ? 30 : 0
    });
}

/**
 * Alarm beenden
 */
function dismissAlarm() {
    AudioPlayer.stop();
    alarmNotification.classList.add('hidden');
    currentlyRingingAlarm = null;
}

/**
 * Snooze
 */
function snoozeAlarm() {
    if (!currentlyRingingAlarm) return;
    
    AudioPlayer.stop();
    alarmNotification.classList.add('hidden');
    
    const snoozeDuration = currentlyRingingAlarm.snooze?.duration || 9;
    const snoozeAlarmCopy = { ...currentlyRingingAlarm };
    
    setTimeout(() => {
        if (currentlyRingingAlarm === null) {
            triggerAlarm(snoozeAlarmCopy);
        }
    }, snoozeDuration * 60 * 1000);
    
    currentlyRingingAlarm = null;
    
    // Status aktualisieren
    nextAlarmText.textContent = `Snooze: ${snoozeDuration} min`;
    nextAlarmText.classList.add('alarm-set');
}

/**
 * Nächsten Alarm anzeigen
 */
function updateNextAlarm() {
    const nextAlarm = AlarmManager.getNextAlarm();
    
    if (nextAlarm) {
        const now = new Date();
        const currentDay = WEEKDAYS_MAP[now.getDay()];
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        let dayText = '';
        if (nextAlarm.days.includes(currentDay) && nextAlarm.time > currentTime) {
            dayText = 'Today';
        } else {
            // Finde nächsten Tag
            const dayOrder = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
            const currentDayIndex = dayOrder.indexOf(currentDay);
            
            for (let i = 1; i <= 7; i++) {
                const checkDayIndex = (currentDayIndex + i) % 7;
                const checkDay = dayOrder[checkDayIndex];
                
                if (nextAlarm.days.includes(checkDay)) {
                    if (i === 1) {
                        dayText = 'Tomorrow';
                    } else {
                        dayText = WEEKDAY_NAMES[checkDay];
                    }
                    break;
                }
            }
        }
        
        nextAlarmText.textContent = `${dayText}, ${nextAlarm.time}`;
        nextAlarmText.classList.add('alarm-set');
    } else {
        nextAlarmText.textContent = 'No alarm set';
        nextAlarmText.classList.remove('alarm-set');
    }
}

/**
 * Alarm-Liste rendern
 */
function renderAlarms() {
    const alarms = AlarmManager.getAlarms();
    
    if (alarms.length === 0) {
        alarmsListEl.innerHTML = `
            <div class="empty-state">
                <p>No alarms set</p>
            </div>
        `;
        updateNextAlarm();
        return;
    }
    
    const daysLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const daysOrder = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
    
    alarmsListEl.innerHTML = alarms.map(alarm => `
        <div class="alarm-item ${alarm.enabled ? '' : 'disabled'}" data-id="${alarm.id}">
            <div class="alarm-info" data-alarm-id="${alarm.id}">
                <div class="alarm-time-display">${alarm.time}</div>
                <div class="alarm-details">${alarm.label || 'Alarm'}</div>
                <div class="alarm-days-mini">
                    ${daysOrder.map((day, i) => `
                        <span class="${alarm.days.includes(day) ? 'active' : ''}">${daysLabels[i]}</span>
                    `).join('')}
                </div>
            </div>
            <label class="toggle-switch">
                <input type="checkbox" class="alarm-toggle" data-alarm-id="${alarm.id}" ${alarm.enabled ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
        </div>
    `).join('');
    
    // Event-Delegation für Alarm-Klicks
    alarmsListEl.querySelectorAll('.alarm-info').forEach(el => {
        el.addEventListener('click', (e) => {
            const alarmId = e.currentTarget.dataset.alarmId;
            editAlarm(alarmId);
        });
    });
    
    // Event-Delegation für Toggle-Switches
    alarmsListEl.querySelectorAll('.alarm-toggle').forEach(el => {
        el.addEventListener('change', (e) => {
            e.stopPropagation();
            const alarmId = e.target.dataset.alarmId;
            toggleAlarm(alarmId, e.target.checked);
        });
        el.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
    
    updateNextAlarm();
}

/**
 * Alarm aktivieren/deaktivieren
 */
function toggleAlarm(id, enabled) {
    AlarmManager.updateAlarm(id, { enabled });
    renderAlarms();
}

/**
 * Modal öffnen für neuen Alarm
 */
function openNewAlarmModal() {
    editingAlarmId = null;
    modalTitle.textContent = 'New Alarm';
    deleteAlarmBtn.classList.add('hidden');
    
    // Form zurücksetzen
    alarmForm.reset();
    document.getElementById('alarm-time').value = '07:00';
    document.getElementById('alarm-sound').value = 'gentle-rise';
    document.getElementById('volume-slider').value = 70;
    document.getElementById('fade-enabled').checked = true;
    document.getElementById('snooze-enabled').checked = true;
    document.getElementById('snooze-duration').value = 9;
    
    // Wochentage zurücksetzen (Mo-Fr standardmäßig)
    const dayValues = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
    document.querySelectorAll('input[name="days"]').forEach((cb, i) => {
        cb.checked = i >= 1 && i <= 5; // Mo-Fr
    });
    
    alarmModal.classList.remove('hidden');
}

/**
 * Alarm bearbeiten
 */
function editAlarm(id) {
    const alarm = AlarmManager.getAlarm(id);
    if (!alarm) return;
    
    editingAlarmId = id;
    modalTitle.textContent = 'Edit Alarm';
    deleteAlarmBtn.classList.remove('hidden');
    
    // Form befüllen
    document.getElementById('alarm-id').value = alarm.id;
    document.getElementById('alarm-time').value = alarm.time;
    document.getElementById('alarm-label').value = alarm.label || '';
    document.getElementById('alarm-sound').value = alarm.sound || 'gentle-rise';
    document.getElementById('volume-slider').value = (alarm.volume || 0.7) * 100;
    document.getElementById('fade-enabled').checked = alarm.fadeEnabled !== false;
    document.getElementById('snooze-enabled').checked = alarm.snooze?.enabled !== false;
    document.getElementById('snooze-duration').value = alarm.snooze?.duration || 9;
    
    // Wochentage
    document.querySelectorAll('input[name="days"]').forEach(cb => {
        cb.checked = alarm.days.includes(cb.value);
    });
    
    alarmModal.classList.remove('hidden');
}

/**
 * Modal schließen
 */
function closeModal() {
    alarmModal.classList.add('hidden');
    editingAlarmId = null;
}

/**
 * Alarm speichern
 */
function saveAlarm(e) {
    if (e) e.preventDefault();
    console.log('saveAlarm called');
    
    const time = document.getElementById('alarm-time').value;
    const label = document.getElementById('alarm-label').value;
    const sound = document.getElementById('alarm-sound').value;
    const volume = parseInt(document.getElementById('volume-slider').value) / 100;
    const fadeEnabled = document.getElementById('fade-enabled').checked;
    const days = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(cb => cb.value);
    
    console.log('Form data:', { time, label, sound, volume, fadeEnabled, days });
    
    if (days.length === 0) {
        console.log('No days selected');
        alert('Please select at least one day.');
        return;
    }
    
    const alarmData = {
        time,
        label,
        sound,
        volume,
        fadeEnabled,
        days,
        enabled: true,
        snooze: {
            enabled: document.getElementById('snooze-enabled').checked,
            duration: parseInt(document.getElementById('snooze-duration').value)
        }
    };
    
    console.log('Alarm data:', alarmData);
    
    if (editingAlarmId) {
        console.log('Updating alarm:', editingAlarmId);
        const result = AlarmManager.updateAlarm(editingAlarmId, alarmData);
        console.log('Update result:', result);
    } else {
        console.log('Adding new alarm');
        const result = AlarmManager.addAlarm(alarmData);
        console.log('Add result:', result);
    }
    
    closeModal();
    renderAlarms();
}

/**
 * Alarm löschen
 */
function deleteCurrentAlarm() {
    console.log('deleteCurrentAlarm called, editingAlarmId:', editingAlarmId);
    if (!editingAlarmId) {
        console.log('No editingAlarmId, returning');
        return;
    }
    
    // Direkt löschen ohne confirm Dialog (kann in WebView problematisch sein)
    console.log('Deleting alarm:', editingAlarmId);
    const result = AlarmManager.deleteAlarm(editingAlarmId);
    console.log('Delete result:', result);
    closeModal();
    renderAlarms();
}

/**
 * Sound-Vorschau
 */
function previewSound() {
    const sound = document.getElementById('alarm-sound').value;
    AudioPlayer.preview(sound);
}

/**
 * Event Listeners einrichten
 */
function setupEventListeners() {
    addAlarmBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openNewAlarmModal();
    });
    closeModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });
    alarmForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Form submit event');
        saveAlarm(e);
    });

    // Direkter Click-Handler auf Save-Button (jetzt mit ID)
    const saveBtn = document.getElementById('save-alarm');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Save button clicked');
            saveAlarm(e);
        });
    }

    deleteAlarmBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Delete button clicked');
        deleteCurrentAlarm();
    });
    dismissBtn.addEventListener('click', dismissAlarm);
    snoozeBtn.addEventListener('click', snoozeAlarm);
    document.getElementById('preview-sound').addEventListener('click', previewSound);

    // Settings Button - togglet die Einstellungen
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const settingsPanel = document.querySelector('.settings-panel');
            if (settingsPanel) {
                settingsPanel.classList.toggle('visible');
            }
        });
    }

    // Schließe Settings-Panel bei Klick außerhalb
    document.addEventListener('click', (e) => {
        const settingsPanel = document.querySelector('.settings-panel');
        const settingsBtnEl = document.getElementById('settings-btn');
        const modal = document.getElementById('alarm-modal');
        
        // Nicht schließen, wenn Modal offen ist
        if (modal && !modal.classList.contains('hidden')) {
            return;
        }
        
        if (settingsPanel && settingsPanel.classList.contains('visible')) {
            if (!settingsPanel.contains(e.target) && e.target !== settingsBtnEl && !settingsBtnEl.contains(e.target)) {
                settingsPanel.classList.remove('visible');
            }
        }
    });

    // Window Dragging für Tauri (manuell, da data-tauri-drag-region sich nicht vererbt)
    const clockBody = document.getElementById('clock-body');
    if (clockBody && tauriWindow) {
        clockBody.addEventListener('mousedown', async (e) => {
            // Nur bei linkem Mausklick und nicht auf Buttons
            if (e.buttons === 1 && !e.target.closest('button')) {
                try {
                    const appWindow = tauriWindow.getCurrentWindow();
                    await appWindow.startDragging();
                } catch (err) {
                    console.log('Dragging not available:', err);
                }
            }
        });
    }

    // Modal schließen bei Klick außerhalb
    alarmModal.addEventListener('click', (e) => {
        if (e.target === alarmModal) {
            closeModal();
        }
    });

    // Keyboard Events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!alarmNotification.classList.contains('hidden')) {
                dismissAlarm();
            } else if (!alarmModal.classList.contains('hidden')) {
                closeModal();
            }
        }
    });
    
    // Event Listener für Format-Button
    const timeFormatBtn = document.getElementById('time-format-btn');
    if (timeFormatBtn) {
        timeFormatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            use24HourFormat = !use24HourFormat;
            updateFormatButton();
            saveTimeFormat();
            updateClock();
        });
    }
}

// ==================== TIME FORMAT ====================

// Lade gespeichertes Zeit-Format
function loadTimeFormat() {
    const saved = localStorage.getItem('use24HourFormat');
    if (saved !== null) {
        use24HourFormat = saved === 'true';
    }
    updateFormatButton();
}

// Speichere Zeit-Format
function saveTimeFormat() {
    localStorage.setItem('use24HourFormat', use24HourFormat.toString());
}

// Aktualisiere Format-Button
function updateFormatButton() {
    const formatLabel = document.getElementById('format-label');
    const timeFormatBtn = document.getElementById('time-format-btn');
    if (!formatLabel || !timeFormatBtn) return;
    
    if (use24HourFormat) {
        formatLabel.textContent = '24H';
        timeFormatBtn.classList.remove('active-12h');
    } else {
        formatLabel.textContent = '12H';
        timeFormatBtn.classList.add('active-12h');
    }
}

// ==================== SLEEP MODE ====================

// Sleep Mode Toggle
const sleepModeToggle = document.getElementById('sleep-mode-toggle');
const sleepModeOptions = document.getElementById('sleep-mode-options');
const sleepBrightness = document.getElementById('sleep-brightness');
const brightnessValue = document.getElementById('brightness-value');
const sleepAutoStart = document.getElementById('sleep-auto-start');
const sleepAutoEnd = document.getElementById('sleep-auto-end');

// Lade gespeicherte Sleep Mode Einstellungen
function loadSleepModeSettings() {
    const saved = localStorage.getItem('sleepModeSettings');
    if (saved) {
        sleepModeSettings = JSON.parse(saved);
        
        // UI aktualisieren
        if (sleepModeToggle) sleepModeToggle.checked = sleepModeSettings.enabled;
        if (sleepBrightness) sleepBrightness.value = sleepModeSettings.brightness;
        if (brightnessValue) brightnessValue.textContent = sleepModeSettings.brightness + '%';
        if (sleepAutoStart) sleepAutoStart.value = sleepModeSettings.autoStartTime;
        if (sleepAutoEnd) sleepAutoEnd.value = sleepModeSettings.autoEndTime;
        
        // Options sichtbar machen wenn aktiviert
        if (sleepModeSettings.enabled && sleepModeOptions) {
            sleepModeOptions.classList.add('visible');
        }
    }
}

// Speichere Sleep Mode Einstellungen
function saveSleepModeSettings() {
    localStorage.setItem('sleepModeSettings', JSON.stringify(sleepModeSettings));
}

// Prüfe ob Sleep Mode aktiv sein sollte (basierend auf Uhrzeit)
function checkSleepModeTime() {
    if (!sleepModeSettings.enabled) {
        deactivateSleepMode();
        return;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = sleepModeSettings.autoStartTime.split(':').map(Number);
    const [endH, endM] = sleepModeSettings.autoEndTime.split(':').map(Number);
    
    const startTime = startH * 60 + startM;
    const endTime = endH * 60 + endM;
    
    let shouldBeActive = false;
    
    // Über Mitternacht (z.B. 22:00 - 06:00)
    if (startTime > endTime) {
        shouldBeActive = currentTime >= startTime || currentTime < endTime;
    } else {
        // Am selben Tag (z.B. 13:00 - 14:00)
        shouldBeActive = currentTime >= startTime && currentTime < endTime;
    }
    
    if (shouldBeActive && !sleepModeSettings.isActive) {
        activateSleepMode();
    } else if (!shouldBeActive && sleepModeSettings.isActive) {
        deactivateSleepMode();
    }
}

// Aktiviere Sleep Mode
function activateSleepMode() {
    sleepModeSettings.isActive = true;
    const brightness = sleepModeSettings.brightness / 100;
    document.documentElement.style.setProperty('--sleep-brightness', brightness);
    document.body.classList.add('sleep-mode-active');
    console.log('Sleep Mode activated - Brightness:', sleepModeSettings.brightness + '%');
}

// Deaktiviere Sleep Mode
function deactivateSleepMode() {
    sleepModeSettings.isActive = false;
    document.body.classList.remove('sleep-mode-active');
    console.log('Sleep Mode deactivated');
}

// Event Listener für Sleep Mode
if (sleepModeToggle) {
    sleepModeToggle.addEventListener('change', (e) => {
        sleepModeSettings.enabled = e.target.checked;
        sleepModeOptions.classList.toggle('visible', e.target.checked);
        saveSleepModeSettings();
        checkSleepModeTime();
    });
}

if (sleepBrightness) {
    sleepBrightness.addEventListener('input', (e) => {
        sleepModeSettings.brightness = parseInt(e.target.value);
        brightnessValue.textContent = e.target.value + '%';
        
        // Live-Vorschau wenn Sleep Mode aktiv
        if (sleepModeSettings.isActive) {
            document.documentElement.style.setProperty('--sleep-brightness', sleepModeSettings.brightness / 100);
        }
    });
    
    sleepBrightness.addEventListener('change', saveSleepModeSettings);
}

if (sleepAutoStart) {
    sleepAutoStart.addEventListener('change', (e) => {
        sleepModeSettings.autoStartTime = e.target.value;
        saveSleepModeSettings();
        checkSleepModeTime();
    });
}

if (sleepAutoEnd) {
    sleepAutoEnd.addEventListener('change', (e) => {
        sleepModeSettings.autoEndTime = e.target.value;
        saveSleepModeSettings();
        checkSleepModeTime();
    });
}

// ==================== POWER MANAGEMENT ====================

const preventSleepToggle = document.getElementById('prevent-sleep-toggle');
const powerStatus = document.getElementById('power-status');

// Lade gespeicherte Power Management Einstellungen
function loadPowerSettings() {
    const saved = localStorage.getItem('preventSleepEnabled');
    if (saved !== null) {
        preventSleepEnabled = saved === 'true';
        if (preventSleepToggle) preventSleepToggle.checked = preventSleepEnabled;
        updatePowerStatus();
        
        // Wenn aktiviert, Schlafmodus verhindern
        if (preventSleepEnabled) {
            activatePreventSleep();
        }
    }
}

// Speichere Power Management Einstellungen
function savePowerSettings() {
    localStorage.setItem('preventSleepEnabled', preventSleepEnabled.toString());
}

// Aktiviere Schlafverhinderung
async function activatePreventSleep() {
    if (!tauriInvoke) {
        console.log('Tauri invoke nicht verfügbar');
        return;
    }
    
    try {
        // Verhindere Schlaf für 12 Stunden (wird bei jedem Alarm-Check erneuert)
        const result = await tauriInvoke('prevent_sleep', { minutes: 720 });
        console.log('Prevent Sleep:', result);
        updatePowerStatus();
    } catch (err) {
        console.error('Fehler bei prevent_sleep:', err);
    }
}

// Aktualisiere Power Status Anzeige
function updatePowerStatus() {
    if (!powerStatus) return;
    
    if (preventSleepEnabled) {
        powerStatus.textContent = '✓ Mac-Schlafmodus wird verhindert';
        powerStatus.classList.add('active');
    } else {
        powerStatus.textContent = 'Verhindert Mac-Schlafmodus wenn Alarm aktiv';
        powerStatus.classList.remove('active');
    }
}

// Event Listener für Power Management Toggle
if (preventSleepToggle) {
    preventSleepToggle.addEventListener('change', (e) => {
        preventSleepEnabled = e.target.checked;
        savePowerSettings();
        
        if (preventSleepEnabled) {
            activatePreventSleep();
        }
        updatePowerStatus();
    });
}

// Plan Wake für nächsten Alarm
async function scheduleWakeForNextAlarm() {
    if (!tauriInvoke || !preventSleepEnabled) return;
    
    const alarms = AlarmManager.getAlarms();
    const enabledAlarms = alarms.filter(a => a.enabled);
    
    if (enabledAlarms.length === 0) return;
    
    // Finde den nächsten Alarm
    const nextAlarm = AlarmManager.getNextAlarm();
    if (!nextAlarm) return;
    
    const [hour, minute] = nextAlarm.time.split(':').map(Number);
    
    try {
        const result = await tauriInvoke('schedule_wake', { hour, minute });
        console.log('Schedule Wake:', result);
    } catch (err) {
        // pmset benötigt sudo - das ist normal
        console.log('Schedule Wake erfordert Admin-Rechte:', err);
    }
}

// Initialisierung
function init() {
    // DOM-Elemente initialisieren
    hour1El = document.getElementById('hour1');
    hour2El = document.getElementById('hour2');
    min1El = document.getElementById('min1');
    min2El = document.getElementById('min2');
    amIndicator = document.getElementById('am-indicator');
    pmIndicator = document.getElementById('pm-indicator');
    weekdayItems = document.querySelectorAll('.weekday-item');
    
    nextAlarmText = document.getElementById('next-alarm-text');
    settingsBtn = document.getElementById('settings-btn');
    
    alarmsListEl = document.getElementById('alarms-list');
    addAlarmBtn = document.getElementById('add-alarm-btn');
    
    alarmModal = document.getElementById('alarm-modal');
    alarmForm = document.getElementById('alarm-form');
    closeModalBtn = document.getElementById('close-modal');
    deleteAlarmBtn = document.getElementById('delete-alarm');
    modalTitle = document.getElementById('modal-title');
    
    alarmNotification = document.getElementById('alarm-notification');
    alarmDisplayTime = document.getElementById('alarm-display-time');
    alarmDisplayLabel = document.getElementById('alarm-display-label');
    snoozeBtn = document.getElementById('snooze-btn');
    dismissBtn = document.getElementById('dismiss-btn');
    
    // Event Listener hinzufügen
    setupEventListeners();
    
    // Zeit-Format laden bevor Uhr aktualisiert wird
    loadTimeFormat();
    
    updateClock();
    setInterval(updateClock, 1000);
    renderAlarms();
    
    // Sleep Mode initialisieren
    loadSleepModeSettings();
    checkSleepModeTime();
    setInterval(checkSleepModeTime, 60000); // Jede Minute prüfen
    
    // Power Management initialisieren
    loadPowerSettings();
    
    // Caffeinate alle 10 Stunden erneuern (wenn aktiviert)
    setInterval(() => {
        if (preventSleepEnabled) {
            activatePreventSleep();
        }
    }, 10 * 60 * 60 * 1000);
    
    console.log('AlarmMaster - Initialized');
}

// Start
document.addEventListener('DOMContentLoaded', init);
