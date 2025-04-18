import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import '../styles/app.css';

const Microphone: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [volume, setVolume] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  const socket = io('https://bluetooth-mic-server.onrender.com', {
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
  });

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      setError('');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setError('נותק מהשרת. מנסה להתחבר מחדש...');
    });

    socket.on('connect_error', () => {
      setError('שגיאת התחברות לשרת');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, []);

  const startRecording = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      setIsRecording(true);
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
      setError('לא ניתן לגשת למיקרופון. אנא אשר גישה למיקרופון בדפדפן.');
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

  return (
    <div className="app-container">
      <header className="header">
        <h1>מיקרופון בלוטות׳</h1>
        <p>הפוך את הטלפון שלך למיקרופון אלחוטי</p>
      </header>

      <div className="mic-card">
        <button 
          className={`mic-button ${isRecording ? 'recording' : ''}`}
          onClick={toggleRecording}
          disabled={!!error && !isRecording}
        >
          <i className="material-icons">
            {isRecording ? 'mic' : 'mic_none'}
          </i>
        </button>

        <div className={`status ${isConnected ? 'connected' : error ? 'error' : ''}`}>
          {error ? error : isConnected ? 'מחובר לשרת' : 'מתחבר לשרת...'}
        </div>

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