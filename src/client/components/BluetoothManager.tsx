import React, { useState, useEffect } from 'react';

declare global {
  interface Navigator {
    bluetooth: {
      requestDevice: (options: {
        acceptAllDevices?: boolean;
        optionalServices?: string[];
      }) => Promise<BluetoothDevice>;
    };
  }
}

interface BluetoothDevice {
  id: string;
  name: string;
  connected: boolean;
  gatt?: {
    connect: () => Promise<any>;
    disconnect: () => Promise<void>;
  };
}

interface BluetoothManagerProps {
  onDeviceSelected: (device: BluetoothDevice) => void;
  onConnectionStatus: (status: boolean) => void;
}

const BluetoothManager: React.FC<BluetoothManagerProps> = ({ onDeviceSelected, onConnectionStatus }) => {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<BluetoothDevice | null>(null);

  const scanForDevices = async () => {
    try {
      setIsScanning(true);
      setError(null);

      // Request Bluetooth device with audio-specific services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          'generic_access',
          'audio_control',
          'audio_streaming',
          'a2dp_source',
          'a2dp_sink'
        ]
      });

      const newDevice: BluetoothDevice = {
        id: device.id,
        name: device.name || 'Unknown Device',
        connected: false
      };

      setDevices([newDevice]);
      setCurrentDevice(newDevice);
      await connectToDevice(device);
    } catch (err) {
      setError('Failed to scan for Bluetooth devices');
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = async (device: BluetoothDevice) => {
    try {
      setIsConnecting(true);
      setError(null);

      // Connect to the device
      const server = await device.gatt?.connect();
      
      if (server) {
        // Get the audio service
        const audioService = await server.getPrimaryService('audio_control');
        
        // Update device status
        const updatedDevice = { ...currentDevice!, connected: true };
        setCurrentDevice(updatedDevice);
        onDeviceSelected(updatedDevice);
        onConnectionStatus(true);
      }
    } catch (err) {
      setError('Failed to connect to device');
      console.error(err);
      onConnectionStatus(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectDevice = async () => {
    if (currentDevice) {
      try {
        await currentDevice.gatt?.disconnect();
        const updatedDevice = { ...currentDevice, connected: false };
        setCurrentDevice(updatedDevice);
        onConnectionStatus(false);
      } catch (err) {
        setError('Failed to disconnect device');
        console.error(err);
      }
    }
  };

  return (
    <div className="bluetooth-manager">
      <div className="device-controls">
        <button 
          onClick={scanForDevices} 
          disabled={isScanning || isConnecting}
          className="scan-button"
        >
          {isScanning ? 'Scanning...' : 'Scan for Devices'}
        </button>
        {currentDevice?.connected && (
          <button 
            onClick={disconnectDevice}
            className="disconnect-button"
          >
            Disconnect
          </button>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {currentDevice && (
        <div className="device-status">
          <h3>Current Device:</h3>
          <div className="device-info">
            <span className="device-name">{currentDevice.name}</span>
            <span className={`connection-status ${currentDevice.connected ? 'connected' : 'disconnected'}`}>
              {currentDevice.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BluetoothManager; 