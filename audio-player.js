/**
 * Audio Player
 * Verwaltet die Sound-Wiedergabe mit Lautstärke-Rampe
 */

const AudioPlayer = (function() {
    let audioContext = null;
    let currentSource = null;
    let gainNode = null;
    let isPlaying = false;
    let volumeInterval = null;
    let oscillators = [];

    // Vordefinierte Sounds (als Oszillator-basierte Töne)
    const SOUNDS = {
        cosmic: { 
            type: 'sine', 
            frequencies: [392, 523, 659, 784], 
            name: 'Cosmic',
            tempo: 400
        },
        gentle: { 
            type: 'sine', 
            frequencies: [262, 330, 392], 
            name: 'Gentle',
            tempo: 600
        },
        classic: { 
            type: 'square', 
            frequencies: [880, 0, 880, 0], 
            name: 'Classic',
            tempo: 250
        }
    };

    /**
     * Audio Context initialisieren
     */
    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        return audioContext;
    }

    /**
     * Oszillator-basierter Alarm-Sound erzeugen
     */
    function createAlarmOscillator(soundType, frequency) {
        const ctx = initAudioContext();
        const oscillator = ctx.createOscillator();
        
        oscillator.type = SOUNDS[soundType]?.type || 'sine';
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
        
        return oscillator;
    }

    /**
     * Alarm abspielen mit Lautstärke-Rampe
     */
    function playAlarm(soundType, options = {}) {
        const startVolume = options.startVolume || 0.1;
        const endVolume = options.endVolume || 1.0;
        const duration = options.duration || 30;

        stop();

        const ctx = initAudioContext();
        const sound = SOUNDS[soundType] || SOUNDS.cosmic;
        
        gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(startVolume, ctx.currentTime);
        gainNode.connect(ctx.destination);

        isPlaying = true;
        let noteIndex = 0;

        function playNextNote() {
            if (!isPlaying) return;

            // Alte Oszillatoren stoppen
            oscillators.forEach(osc => {
                try { osc.stop(); } catch(e) {}
            });
            oscillators = [];

            const frequency = sound.frequencies[noteIndex % sound.frequencies.length];
            
            if (frequency > 0) {
                const oscillator = ctx.createOscillator();
                oscillator.type = sound.type;
                oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
                oscillator.connect(gainNode);
                oscillator.start();
                oscillators.push(oscillator);
            }

            noteIndex++;
            setTimeout(playNextNote, sound.tempo || 400);
        }

        playNextNote();

        // Lautstärke-Rampe (nur wenn duration > 0)
        if (duration > 0) {
            const volumeStep = (endVolume - startVolume) / (duration * 10);
            let currentVolume = startVolume;

            volumeInterval = setInterval(() => {
                if (!isPlaying || currentVolume >= endVolume) {
                    if (volumeInterval) {
                        clearInterval(volumeInterval);
                        volumeInterval = null;
                    }
                    return;
                }

                currentVolume = Math.min(currentVolume + volumeStep, endVolume);
                if (gainNode && audioContext) {
                    gainNode.gain.setValueAtTime(currentVolume, audioContext.currentTime);
                }
            }, 100);
        }
    }

    /**
     * Sound stoppen
     */
    function stop() {
        isPlaying = false;

        if (volumeInterval) {
            clearInterval(volumeInterval);
            volumeInterval = null;
        }

        if (gainNode && audioContext) {
            try {
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            } catch (e) {}
        }

        oscillators.forEach(osc => {
            try { osc.stop(); } catch(e) {}
        });
        oscillators = [];

        if (currentSource) {
            try {
                currentSource.stop();
            } catch (e) {}
            currentSource = null;
        }
    }

    /**
     * Sound-Vorschau (kurz abspielen)
     */
    function preview(soundType) {
        stop();

        const ctx = initAudioContext();
        const sound = SOUNDS[soundType] || SOUNDS.cosmic;

        gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.connect(ctx.destination);

        let noteIndex = 0;
        const maxNotes = sound.frequencies.length * 2;
        
        const playNote = () => {
            if (noteIndex >= maxNotes) {
                stop();
                return;
            }

            const frequency = sound.frequencies[noteIndex % sound.frequencies.length];
            
            if (frequency > 0) {
                const oscillator = ctx.createOscillator();
                oscillator.type = sound.type;
                oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
                oscillator.connect(gainNode);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.25);
            }

            noteIndex++;
            setTimeout(playNote, sound.tempo || 300);
        };

        playNote();
    }

    /**
     * Verfügbare Sounds abrufen
     */
    function getAvailableSounds() {
        return Object.entries(SOUNDS).map(([id, sound]) => ({
            id,
            name: sound.name
        }));
    }

    /**
     * Prüfen ob gerade abgespielt wird
     */
    function isCurrentlyPlaying() {
        return isPlaying;
    }

    // Public API
    return {
        playAlarm,
        stop,
        preview,
        getAvailableSounds,
        isPlaying: isCurrentlyPlaying
    };
})();
