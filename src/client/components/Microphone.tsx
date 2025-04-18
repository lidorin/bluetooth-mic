import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import BluetoothManager from './BluetoothManager';
import LatencyMonitor from './LatencyMonitor';

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
}

const Microphone: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Initialize socket connection with auto-reconnect
    socketRef.current = io('https://bluetooth-mic.vercel.app', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (err) => {
      setError('Connection error: ' + err.message);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleDeviceSelected = (device: BluetoothDevice) => {
    setSelectedDevice(device);
    setError(null);
  };

  const handleConnectionStatus = (status: boolean) => {
    if (!status && isRecording) {
      stopRecording();
    }
  };

  const updateAudioLevel = () => {
    if (analyserRef.current && mediaStreamRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255); // Normalize to 0-1
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  };

  const startRecording = async () => {
    try {
      // Request microphone access with optimal settings
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      mediaStreamRef.current = stream;

      // Create audio context with optimal settings
      audioContextRef.current = new AudioContext({
        latencyHint: 'interactive',
        sampleRate: 48000
      });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      
      // Create analyser for audio level visualization
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Create script processor with minimal buffer size
      const processor = audioContextRef.current.createScriptProcessor(1024, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (socketRef.current?.connected) {
          const audioData = e.inputBuffer.getChannelData(0);
          socketRef.current.emit('audioData', audioData);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      // Start audio level visualization
      updateAudioLevel();
      
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError('Failed to access microphone: ' + (err as Error).message);
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  return (
    <div className="microphone-container">
      <h1>Bluetooth Microphone</h1>
      <div className="status">
        <div className="connection-status">
          Server: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        {selectedDevice && (
          <div className="device-status">
            Device: {selectedDevice.name} ({selectedDevice.connected ? 'Connected' : 'Disconnected'})
          </div>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      <BluetoothManager 
        onDeviceSelected={handleDeviceSelected}
        onConnectionStatus={handleConnectionStatus}
      />
      <div className="audio-visualizer">
        <div 
          className="audio-level" 
          style={{ width: `${audioLevel * 100}%` }}
        />
      </div>
      <div className="controls">
        {!isRecording ? (
          <button 
            onClick={startRecording} 
            disabled={!isConnected || !selectedDevice?.connected}
            className="record-button"
          >
            Start Recording
          </button>
        ) : (
          <button 
            onClick={stopRecording}
            className="stop-button"
          >
            Stop Recording
          </button>
        )}
      </div>
      {isRecording && socketRef.current && (
        <LatencyMonitor 
          isRecording={isRecording} 
          socket={socketRef.current} 
        />
      )}
    </div>
  );
};

export default Microphone; 