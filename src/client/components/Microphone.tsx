import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import '../styles/app.css';

const Microphone: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [volume, setVolume] = useState(0);
  const [isReceiver, setIsReceiver] = useState(false);

  const socket = io('https://bluetooth-mic-server.onrender.com', {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
  });

  useEffect(() => {
    // Handle incoming audio data
    socket.on('audio', (data) => {
      if (isReceiver) {
        const audioContext = new AudioContext();
        const audioBlob = new Blob([data], { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
      }
    });

    return () => {
      socket.off('audio');
    };
  }, [isReceiver]);

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      setIsRecording(true);
      setIsReceiver(false);
      setError('');

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(mediaStream);
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);

      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      const updateVolume = () => {
        if (isRecording) {
          analyzer.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolume(Math.min(average / 128, 1));
          requestAnimationFrame(updateVolume);
        }
      };
      updateVolume();

      const recorder = new MediaRecorder(mediaStream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.connected) {
          socket.emit('audio', event.data);
        }
      };
      recorder.start(100);
    } catch (err) {
      setError('Please allow microphone access in your browser');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsRecording(false);
    setVolume(0);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const toggleReceiver = () => {
    setIsReceiver(!isReceiver);
    if (isRecording) {
      stopRecording();
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Wireless Microphone</h1>
        <p>Turn your phone into a wireless microphone</p>
      </header>

      <div className="mic-card">
        <button 
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={!!error && !isRecording || isReceiver}
        >
          <i className="material-icons">
            {isRecording ? 'mic' : 'mic_none'}
          </i>
        </button>

        <button
          className={`receiver-button ${isReceiver ? 'active' : ''}`}
          onClick={toggleReceiver}
          disabled={isRecording}
        >
          <i className="material-icons">
            {isReceiver ? 'volume_up' : 'volume_off'}
          </i>
        </button>

        {error && <div className="error-message">{error}</div>}

        {isRecording && (
          <div className="volume-meter">
            <div 
              className="volume-meter-fill" 
              style={{ width: `${volume * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Microphone; 