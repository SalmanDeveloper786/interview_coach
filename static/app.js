document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const toggleListenBtn = document.getElementById('toggleListenBtn') || document.getElementById('toggle-listen-btn');
    const btnText = document.getElementById('btnText') || document.getElementById('btn-text');
    const statusText = document.getElementById('statusText') || document.getElementById('status-text');
    const recordingPulse = document.getElementById('recordingPulse') || document.getElementById('recording-pulse');
    const transcriptionBox = document.getElementById('transcriptionBox') || document.getElementById('transcription-box');
    const interimTextDiv = document.getElementById('interimText') || document.getElementById('interim-text');
    const suggestionBox = document.getElementById('suggestionBox') || document.getElementById('suggestion-box');
    const processingIndicator = document.getElementById('processingIndicator') || document.getElementById('processing-indicator');
    const micIcon = toggleListenBtn.querySelector('i');

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
    const volumeMeterContainer = document.getElementById('volume-meter-container');
    const volumeMeter = document.getElementById('volume-meter');

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

            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            analyser.smoothingTimeConstant = 0.8;
            analyser.fftSize = 1024;
            
            microphone = audioContext.createMediaStreamSource(audioStream);
            microphone.connect(analyser);
            
            if (volumeMeterContainer) volumeMeterContainer.style.display = 'block';
            updateVolumeMeter();

        } catch (err) {
            console.error("Error setting up audio context: ", err);
        }
    }

    function updateVolumeMeter() {
        if (!analyser) return;
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;
        for (let i = 0; i < array.length; i++) {
            values += array[i];
        }
        let average = values / array.length;
        let percentage = Math.min(100, Math.round((average / 128) * 100));
        
        if (volumeMeter) {
            volumeMeter.style.width = percentage + '%';
            if (percentage > 70) volumeMeter.style.background = 'var(--danger)';
            else if (percentage > 30) volumeMeter.style.background = 'var(--primary)';
            else volumeMeter.style.background = 'var(--success)';
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
        if (volumeMeterContainer) volumeMeterContainer.style.display = 'none';
        if (volumeMeter) volumeMeter.style.width = '0%';
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

        // Update interim text display
        interimTextDiv.textContent = interimTranscript;
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

        // Create new text node for final transcript without overwriting interim div
        let p = document.createElement('p');
        p.textContent = finalTranscript;
        
        // Rebuild transcription box
        transcriptionBox.innerHTML = '';
        transcriptionBox.appendChild(p);
        transcriptionBox.appendChild(interimTextDiv);
        interimTextDiv.textContent = ''; // clear interim
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
            toggleListenBtn.classList.add('listening');
            btnText.textContent = 'Stop Listening';
            micIcon.setAttribute('data-lucide', 'square');
            lucide.createIcons();
            
            recordingPulse.classList.add('active');
            statusText.textContent = 'Listening...';
            statusText.style.color = 'var(--danger)';
            
            finalTranscript = '';
            lastProcessedText = '';
            transcriptionBox.innerHTML = '<div id="interim-text" class="interim"></div>';
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
        toggleListenBtn.classList.remove('listening');
        btnText.textContent = 'Start Listening';
        micIcon.setAttribute('data-lucide', 'mic');
        lucide.createIcons();
        
        recordingPulse.classList.remove('active');
        statusText.textContent = 'Ready to Listen';
        statusText.style.color = 'var(--text-primary)';
        interimTextDiv.textContent = '';
        
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

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
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
