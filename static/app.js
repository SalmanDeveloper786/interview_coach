document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const toggleListenBtn = document.getElementById('toggleListenBtn') || document.getElementById('toggle-listen-btn');
    const btnText = document.getElementById('btnText') || document.getElementById('btn-text');
    const statusText = document.getElementById('statusText') || document.getElementById('status-text');
    const recordingPulse = document.getElementById('recordingPulse') || document.getElementById('recording-pulse');
    const transcriptionBox = document.getElementById('transcriptionBox') || document.getElementById('transcription-box');
    const suggestionBox = document.getElementById('suggestionBox') || document.getElementById('suggestion-box');
    const processingIndicator = document.getElementById('processingIndicator') || document.getElementById('processing-indicator');
    const micIcon = toggleListenBtn.querySelector('i');

    // Cinematic Reveal Elements
    const enterTrigger = document.getElementById('enter-trigger');
    const revealScreen = document.getElementById('reveal-screen');
    const dashboardWrapper = document.getElementById('dashboard-wrapper');
    const particleZone = document.getElementById('particle-zone');

    // Cinematic Orchestration
    if (enterTrigger && revealScreen && dashboardWrapper) {
        // Automatically trigger animation after a short delay
        setTimeout(() => {
            // Generate Particle Explosion
            if (particleZone) {
                for(let i=0; i<40; i++) {
                    const p = document.createElement('div');
                    p.className = 'particle';
                    
                    // Random explosion vectors
                    const angle = Math.random() * Math.PI * 2;
                    const velocity = 80 + Math.random() * 200;
                    const tx = Math.cos(angle) * velocity;
                    const ty = Math.sin(angle) * velocity;
                    const scale = 0.5 + Math.random() * 1.5;
                    
                    p.style.setProperty('--tx', `${tx}px`);
                    p.style.setProperty('--ty', `${ty}px`);
                    p.style.setProperty('--s', scale);
                    
                    particleZone.appendChild(p);
                    
                    // Trigger GPU transition next frame
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            p.classList.add('pop');
                        });
                    });
                }
            }

            // Trigger Split Transition & Dashboard Entry
            revealScreen.classList.add('active-reveal');
            dashboardWrapper.classList.remove('hidden-initial');
            dashboardWrapper.classList.add('active-reveal');

            // Cleanup DOM
            setTimeout(() => {
                revealScreen.style.opacity = '0';
                setTimeout(() => revealScreen.style.display = 'none', 500);
            }, 1500);
        }, 800); // Wait 800ms after load before starting sequence
    }

    // State
    let isListening = false;
    let recognition = null;
    let finalTranscript = '';
    let silenceTimer = null;
    let lastProcessedText = '';

    // Audio Context State for Volume Meter & Raw Mic Access
    let audioContext;
    let analyser;
    let microphone;
    let audioStream = null;
    let animationId;
    const canvasMeter = document.getElementById('audio-meter');

    async function setupAudioContext() {
        try {
            // Requesting raw audio without suppression/echo cancellation
            audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            if (!audioContext) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                audioContext = new AudioContextClass();
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            
            analyser = audioContext.createAnalyser();
            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;
            
            microphone = audioContext.createMediaStreamSource(audioStream);
            microphone.connect(analyser);
            
            if (canvasMeter) canvasMeter.style.display = 'block';
            updateVolumeMeter();

        } catch (err) {
            console.error("Error setting up audio context: ", err);
        }
    }

    function updateVolumeMeter() {
        if (!analyser || !canvasMeter) return;
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        
        const ctx = canvasMeter.getContext('2d');
        const width = canvasMeter.width;
        const height = canvasMeter.height;
        
        ctx.clearRect(0, 0, width, height);
        
        const numBars = 5;
        const barWidth = 4;
        const gap = 3;
        const totalWidth = (numBars * barWidth) + ((numBars - 1) * gap);
        const startX = (width - totalWidth) / 2;
        
        // We only care about the lower frequencies for human voice (e.g. first 1/4 of the array)
        const activeArrayLength = Math.floor(array.length / 4);
        const chunkSize = Math.floor(activeArrayLength / numBars);
        
        for (let i = 0; i < numBars; i++) {
            let sum = 0;
            for(let j = 0; j < chunkSize; j++) {
                sum += array[i * chunkSize + j];
            }
            let avg = sum / chunkSize;
            // Boost low signals slightly for visual effect
            let normalized = Math.min(1, (avg / 255) * 1.5);
            let barHeight = Math.max(3, normalized * height);
            
            // Draw rounded bar
            ctx.fillStyle = '#60a5fa'; // Blue accent
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(startX + i * (barWidth + gap), height - barHeight, barWidth, barHeight, 2);
            } else {
                ctx.fillRect(startX + i * (barWidth + gap), height - barHeight, barWidth, barHeight);
            }
            ctx.fill();
        }
        
        animationId = requestAnimationFrame(updateVolumeMeter);
    }

    function stopAudioContext() {
        if (animationId) cancelAnimationFrame(animationId);
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            audioStream = null;
        }
        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }
        if (canvasMeter) {
            canvasMeter.style.display = 'none';
            const ctx = canvasMeter.getContext('2d');
            ctx.clearRect(0, 0, canvasMeter.width, canvasMeter.height);
        }
    }

    // Initialize Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        statusText.textContent = "Browser not supported. Please use Chrome.";
        toggleListenBtn.disabled = true;
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Set language if needed
    // recognition.lang = 'en-US';

    // Handle results
    recognition.onresult = (event) => {
        let interimTranscript = '';
        let newFinalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                newFinalText += event.results[i][0].transcript + ' ';
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (newFinalText) {
            finalTranscript += newFinalText;
            updateTranscriptionUI();
            
            // Clear existing silence timer
            if (silenceTimer) clearTimeout(silenceTimer);
            
            // Set timer to trigger API call if silence follows a final transcript
            silenceTimer = setTimeout(() => {
                triggerAI(finalTranscript);
            }, 1500); // 1.5 seconds of silence triggers API
        }

        // Update status text with interim text (or fallback to Listening)
        if (interimTranscript) {
            statusText.textContent = interimTranscript;
        } else {
            statusText.textContent = 'Listening...';
        }
        
        scrollToBottom(transcriptionBox);
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            statusText.textContent = "Microphone access denied.";
            stopListening();
        }
    };

    recognition.onend = () => {
        // Auto-restart if we are still supposed to be listening
        if (isListening) {
            try {
                recognition.start();
            } catch (e) {
                console.error("Could not restart recognition:", e);
                stopListening();
            }
        }
    };

    // UI Actions
    function updateTranscriptionUI() {
        // Remove placeholder if present
        const placeholder = transcriptionBox.querySelector('.placeholder-text');
        if (placeholder) placeholder.remove();

        // Create new text node for final transcript
        let p = document.createElement('p');
        p.textContent = finalTranscript;
        
        // Rebuild transcription box
        transcriptionBox.innerHTML = '';
        transcriptionBox.appendChild(p);
    }

    function scrollToBottom(element) {
        element.scrollTop = element.scrollHeight;
    }

    async function startListening() {
        try {
            // First setup raw audio constraints to ensure browser configures hardware accordingly
            await setupAudioContext();
            
            recognition.start();
            isListening = true;
            
            // Update UI
            toggleListenBtn.classList.add('is-listening');
            btnText.textContent = 'Stop Listening';
            micIcon.setAttribute('data-lucide', 'square');
            lucide.createIcons();
            
            recordingPulse.classList.add('active');
            statusText.textContent = 'Listening...';
            statusText.style.color = 'var(--danger)';
            
            finalTranscript = '';
            lastProcessedText = '';
            transcriptionBox.innerHTML = '';
            suggestionBox.innerHTML = '<p class="placeholder-text">Listening for context...</p>';
            
        } catch (e) {
            console.error("Error starting recognition:", e);
        }
    }

    function stopListening() {
        isListening = false;
        recognition.stop();
        stopAudioContext();
        if (silenceTimer) clearTimeout(silenceTimer);
        
        // Update UI
        toggleListenBtn.classList.remove('is-listening');
        btnText.textContent = 'Start Listening';
        micIcon.setAttribute('data-lucide', 'mic');
        lucide.createIcons();
        
        recordingPulse.classList.remove('active');
        statusText.textContent = 'Ready to Listen';
        statusText.style.color = 'var(--text-primary)';
        
        // Process anything left
        if (finalTranscript.trim() && finalTranscript !== lastProcessedText) {
            triggerAI(finalTranscript);
        }
    }

    async function triggerAI(text) {
        const queryText = text.trim();
        if (!queryText || queryText === lastProcessedText) return;
        
        lastProcessedText = queryText;
        
        // Show processing UI
        processingIndicator.classList.add('active');
        
        try {
            // Check which endpoint to use based on the python backend
            // Using /api/ask since that's what was setup in main.py
            const formData = new FormData();
            formData.append('question', queryText);

            const response = await fetch('/api/ask', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            // Clear suggestion box and prepare for streaming
            suggestionBox.innerHTML = '';
            const p = document.createElement('p');
            suggestionBox.appendChild(p);

            // Pulse the suggestion box subtly
            suggestionBox.parentElement.style.transform = 'scale(1.02)';
            setTimeout(() => {
                suggestionBox.parentElement.style.transform = 'translateY(-2px)';
            }, 200);

            // Set up stream reader
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            
            // Hide processing indicator once streaming starts
            processingIndicator.classList.remove('active');
            p.classList.add('streaming-text'); // Append pulsing cursor

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    p.classList.remove('streaming-text'); // Remove cursor
                    break;
                }
                
                const chunk = decoder.decode(value, { stream: true });
                // Append text and convert basic newlines to <br>
                const formattedChunk = chunk.replace(/\n/g, '<br>');
                p.innerHTML += formattedChunk;
                
                scrollToBottom(suggestionBox);
            }

        } catch (error) {
            console.error('Error fetching suggestion:', error);
            const placeholder = document.createElement('p');
            placeholder.className = 'placeholder-text';
            placeholder.style.color = 'var(--danger)';
            placeholder.textContent = 'Error reaching AI service. Ensure backend is running.';
            suggestionBox.innerHTML = '';
            suggestionBox.appendChild(placeholder);
        } finally {
            processingIndicator.classList.remove('active');
            const p = suggestionBox.querySelector('p');
            if (p) p.classList.remove('streaming-text');
        }
    }

    // Toggle Button Event
    toggleListenBtn.addEventListener('click', () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    });
});
