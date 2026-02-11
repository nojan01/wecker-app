/**
 * Wecker-App - Hauptanwendung
 * Verwaltet die Digitaluhr-Anzeige und koordiniert alle Module
 */

// Tauri API
let tauriWindow = null;
let tauriInvoke = null;
if (window.__TAURI__) {
    tauriWindow = window.__TAURI__.window;
    tauriInvoke = window.__TAURI__.core?.invoke;
}

// DOM-Elemente - Uhr
const hour1El = document.getElementById('hour1');
const hour2El = document.getElementById('hour2');
const min1El = document.getElementById('min1');
const min2El = document.getElementById('min2');
const amIndicator = document.getElementById('am-indicator');
const pmIndicator = document.getElementById('pm-indicator');
const weekdayItems = document.querySelectorAll('.weekday-item');

// DOM-Elemente - Status
const nextAlarmText = document.getElementById('next-alarm-text');
const settingsBtn = document.getElementById('settings-btn');

// DOM-Elemente - Alarmliste
const alarmsListEl = document.getElementById('alarms-list');
const addAlarmBtn = document.getElementById('add-alarm-btn');

// DOM-Elemente - Modal
const alarmModal = document.getElementById('alarm-modal');
const alarmForm = document.getElementById('alarm-form');
const closeModalBtn = document.getElementById('close-modal');
const deleteAlarmBtn = document.getElementById('delete-alarm');
const modalTitle = document.getElementById('modal-title');

// DOM-Elemente - Alarm-Benachrichtigung
const alarmNotification = document.getElementById('alarm-notification');
const alarmDisplayTime = document.getElementById('alarm-display-time');
const alarmDisplayLabel = document.getElementById('alarm-display-label');
const snoozeBtn = document.getElementById('snooze-btn');
const dismissBtn = document.getElementById('dismiss-btn');

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
    
    // AM/PM aktualisieren
    if (use24HourFormat) {
        amIndicator.classList.remove('active');
        pmIndicator.classList.remove('active');
    } else {
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
    const currentSeconds = now.getSeconds();
    
    const alarms = AlarmManager.getAlarms();
    
    for (const alarm of alarms) {
        if (!alarm.enabled) continue;
        if (!alarm.days.includes(currentDay)) continue;
        
        // Prüfe ob der Alarm in 30 Sekunden startet (Bildschirm aufwecken)
        const [alarmHour, alarmMin] = alarm.time.split(':').map(Number);
        const alarmTotalSeconds = alarmHour * 3600 + alarmMin * 60;
        const nowTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + currentSeconds;
        const secondsUntilAlarm = alarmTotalSeconds - nowTotalSeconds;
        
        // 30 Sekunden vorher: Bildschirm aufwecken
        if (secondsUntilAlarm === 30 && tauriInvoke) {
            tauriInvoke('wake_screen').catch(err => console.log('Wake screen error:', err));
        }
        
        // Alarm auslösen
        if (alarm.time === currentTime && currentSeconds === 0) {
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
    AudioPlayer.playAlarm(alarm.sound || 'cosmic', {
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
        
        // Zeige Alarm-Label statt Tag, oder "Alarm" als Fallback
        const labelText = nextAlarm.label || dayText || 'Alarm';
        nextAlarmText.textContent = `${labelText}, ${nextAlarm.time}`;
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
            <div class="alarm-info" onclick="editAlarm('${alarm.id}')">
                <div class="alarm-time-display">${alarm.time}</div>
                <div class="alarm-details">${alarm.label || 'Alarm'}</div>
                <div class="alarm-days-mini">
                    ${daysOrder.map((day, i) => `
                        <span class="${alarm.days.includes(day) ? 'active' : ''}">${daysLabels[i]}</span>
                    `).join('')}
                </div>
            </div>
            <label class="toggle-switch" onclick="event.stopPropagation()">
                <input type="checkbox" ${alarm.enabled ? 'checked' : ''} 
                       onchange="toggleAlarm('${alarm.id}', this.checked)">
                <span class="toggle-slider"></span>
            </label>
        </div>
    `).join('');
    
    updateNextAlarm();
}

/**
 * Alarm aktivieren/deaktivieren
 */
function toggleAlarm(id, enabled) {
    AlarmManager.updateAlarm(id, { enabled });
    renderAlarms();
    syncWakeSchedule();
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
    document.getElementById('alarm-sound').value = 'cosmic';
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
    document.getElementById('alarm-sound').value = alarm.sound || 'cosmic';
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
    e.preventDefault();
    
    const time = document.getElementById('alarm-time').value;
    const label = document.getElementById('alarm-label').value;
    const sound = document.getElementById('alarm-sound').value;
    const volume = parseInt(document.getElementById('volume-slider').value) / 100;
    const fadeEnabled = document.getElementById('fade-enabled').checked;
    const days = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(cb => cb.value);
    
    if (days.length === 0) {
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
    
    if (editingAlarmId) {
        AlarmManager.updateAlarm(editingAlarmId, alarmData);
    } else {
        AlarmManager.addAlarm(alarmData);
    }
    
    closeModal();
    renderAlarms();
    syncWakeSchedule();
}

/**
 * Alarm löschen
 */
function deleteCurrentAlarm() {
    if (!editingAlarmId) return;
    
    if (confirm('Delete this alarm?')) {
        AlarmManager.deleteAlarm(editingAlarmId);
        closeModal();
        renderAlarms();
        syncWakeSchedule();
    }
}

/**
 * Sound-Vorschau
 */
function previewSound() {
    const sound = document.getElementById('alarm-sound').value;
    AudioPlayer.preview(sound);
}

// Event Listeners
addAlarmBtn.addEventListener('click', openNewAlarmModal);
closeModalBtn.addEventListener('click', closeModal);
alarmForm.addEventListener('submit', saveAlarm);
deleteAlarmBtn.addEventListener('click', deleteCurrentAlarm);
dismissBtn.addEventListener('click', dismissAlarm);
snoozeBtn.addEventListener('click', snoozeAlarm);
document.getElementById('preview-sound').addEventListener('click', previewSound);

// Settings Button - scrollt zu den Einstellungen
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        const settingsPanel = document.querySelector('.settings-panel');
        if (settingsPanel) {
            settingsPanel.scrollIntoView({ behavior: 'smooth' });
        }
    });
}

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

// Zeit-Format umschalten (Klick auf Uhr)
document.querySelector('.time-display').addEventListener('click', () => {
    use24HourFormat = !use24HourFormat;
    updateClock();
});

// Initialisierung
function init() {
    updateClock();
    setInterval(updateClock, 1000);
    renderAlarms();
    initWakeHelper();
    
    console.log('Wake Up Time - Initialized');
}

// ============================================================
// Wake Helper Integration
// ============================================================

let wakeHelperInstalled = false;

/**
 * Wake Helper initialisieren
 */
async function initWakeHelper() {
    if (!tauriInvoke) return;
    
    try {
        wakeHelperInstalled = await tauriInvoke('is_wake_helper_installed');
        updateWakeHelperUI();
        
        // Update wake schedule if helper is installed
        if (wakeHelperInstalled) {
            await syncWakeSchedule();
        }
    } catch (err) {
        console.log('Wake helper check error:', err);
    }
}

/**
 * Wake Helper UI aktualisieren
 */
async function updateWakeHelperUI() {
    const statusDot = document.getElementById('helper-status-dot');
    const statusText = document.getElementById('helper-status-text');
    const installBtn = document.getElementById('install-helper-btn');
    const infoSection = document.getElementById('wake-helper-info');
    const nextWakeEl = document.getElementById('wake-helper-next');
    
    if (!statusDot || !installBtn) return;
    
    if (wakeHelperInstalled) {
        statusDot.className = 'status-dot active';
        statusText.textContent = 'Active';
        installBtn.textContent = 'Uninstall';
        installBtn.className = 'btn-helper-install installed';
        
        // Show schedule info
        if (tauriInvoke) {
            try {
                const status = await tauriInvoke('get_wake_helper_status');
                if (status.next_wake) {
                    infoSection.style.display = 'block';
                    const wakeDate = new Date(status.next_wake);
                    nextWakeEl.textContent = `Next wake: ${wakeDate.toLocaleString('de-DE', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}`;
                } else {
                    infoSection.style.display = 'none';
                }
            } catch (err) {
                console.log('Status error:', err);
            }
        }
    } else {
        statusDot.className = 'status-dot inactive';
        statusText.textContent = 'Not installed';
        installBtn.textContent = 'Install Helper';
        installBtn.className = 'btn-helper-install';
        infoSection.style.display = 'none';
    }
}

/**
 * Wake Helper installieren/deinstallieren
 */
async function toggleWakeHelper() {
    if (!tauriInvoke) return;
    
    const btn = document.getElementById('install-helper-btn');
    btn.disabled = true;
    btn.textContent = wakeHelperInstalled ? 'Removing...' : 'Installing...';
    
    try {
        if (wakeHelperInstalled) {
            await tauriInvoke('uninstall_wake_helper');
            wakeHelperInstalled = false;
        } else {
            await tauriInvoke('install_wake_helper');
            wakeHelperInstalled = true;
            // Sync schedule after installation
            await syncWakeSchedule();
        }
    } catch (err) {
        console.error('Wake helper toggle error:', err);
        // Don't show error if user cancelled
        if (!err.toString().includes('abgebrochen') && !err.toString().includes('canceled')) {
            alert('Error: ' + err);
        }
    }
    
    btn.disabled = false;
    updateWakeHelperUI();
}

/**
 * Wake Schedule synchronisieren
 * Berechnet den nächsten Alarm-Zeitpunkt und schreibt ihn in die Schedule-Datei
 */
async function syncWakeSchedule() {
    if (!tauriInvoke || !wakeHelperInstalled) return;
    
    const nextAlarm = AlarmManager.getNextAlarm();
    
    if (!nextAlarm) {
        // No alarm - disable wake schedule
        try {
            await tauriInvoke('update_wake_schedule', { 
                nextWake: null, 
                alarmTime: null, 
                label: null 
            });
        } catch (err) {
            console.log('Schedule clear error:', err);
        }
        return;
    }
    
    // Calculate exact datetime for next alarm
    const now = new Date();
    const [alarmHour, alarmMin] = nextAlarm.time.split(':').map(Number);
    const dayOrder = ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];
    const currentDayIndex = now.getDay();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    let targetDate = null;
    
    // Find the next day this alarm would fire
    for (let i = 0; i <= 7; i++) {
        const checkDayIndex = (currentDayIndex + i) % 7;
        const checkDay = dayOrder[checkDayIndex];
        
        if (!nextAlarm.days.includes(checkDay)) continue;
        
        // If today, alarm must be in the future
        if (i === 0 && nextAlarm.time <= currentTime) continue;
        
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + i);
        targetDate.setHours(alarmHour, alarmMin, 0, 0);
        break;
    }
    
    if (!targetDate) return;
    
    // Format as ISO 8601
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const hour = String(targetDate.getHours()).padStart(2, '0');
    const min = String(targetDate.getMinutes()).padStart(2, '0');
    const isoString = `${year}-${month}-${day}T${hour}:${min}:00`;
    
    try {
        await tauriInvoke('update_wake_schedule', {
            nextWake: isoString,
            alarmTime: nextAlarm.time,
            label: nextAlarm.label || 'Alarm'
        });
        console.log('Wake schedule synced:', isoString);
    } catch (err) {
        console.log('Schedule sync error:', err);
    }
}

// Start
document.addEventListener('DOMContentLoaded', init);
