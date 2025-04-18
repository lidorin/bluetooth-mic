import React, { useEffect, useRef, useState } from 'react';

interface LatencyMonitorProps {
  isRecording: boolean;
  socket: any;
}

const LatencyMonitor: React.FC<LatencyMonitorProps> = ({ isRecording, socket }) => {
  const [latency, setLatency] = useState<number>(0);
  const [averageLatency, setAverageLatency] = useState<number>(0);
  const [maxLatency, setMaxLatency] = useState<number>(0);
  const [minLatency, setMinLatency] = useState<number>(Infinity);
  const measurementsRef = useRef<number[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecording || !socket) return;

    const measureLatency = () => {
      startTimeRef.current = performance.now();
      socket.emit('latencyPing', { timestamp: startTimeRef.current });
    };

    const interval = setInterval(measureLatency, 1000);
    return () => clearInterval(interval);
  }, [isRecording, socket]);

  useEffect(() => {
    if (!socket) return;

    const handlePong = (data: { timestamp: number }) => {
      const endTime = performance.now();
      const currentLatency = endTime - data.timestamp;
      
      setLatency(currentLatency);
      measurementsRef.current.push(currentLatency);
      
      // Update statistics
      setMaxLatency(Math.max(maxLatency, currentLatency));
      setMinLatency(Math.min(minLatency, currentLatency));
      
      // Calculate average over last 10 measurements
      const recentMeasurements = measurementsRef.current.slice(-10);
      const avg = recentMeasurements.reduce((a, b) => a + b, 0) / recentMeasurements.length;
      setAverageLatency(avg);
    };

    socket.on('latencyPong', handlePong);
    return () => {
      socket.off('latencyPong', handlePong);
    };
  }, [socket, maxLatency, minLatency]);

  return (
    <div className="latency-monitor">
      <h3>Latency Monitor</h3>
      <div className="latency-stats">
        <div className="stat">
          <span className="label">Current:</span>
          <span className="value">{latency.toFixed(1)}ms</span>
        </div>
        <div className="stat">
          <span className="label">Average:</span>
          <span className="value">{averageLatency.toFixed(1)}ms</span>
        </div>
        <div className="stat">
          <span className="label">Min:</span>
          <span className="value">{minLatency === Infinity ? '-' : minLatency.toFixed(1)}ms</span>
        </div>
        <div className="stat">
          <span className="label">Max:</span>
          <span className="value">{maxLatency.toFixed(1)}ms</span>
        </div>
      </div>
    </div>
  );
};

export default LatencyMonitor; 