import React, { useEffect, useRef } from 'react';

interface AudioWaveVisualizerProps {
  isPlaying: boolean;
  isListening: boolean;
  className?: string;
}

export const AudioWaveVisualizer: React.FC<AudioWaveVisualizerProps> = ({
  isPlaying,
  isListening,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Determine wave amplitude and speed based on state
      const targetAmp = isPlaying ? 28 : isListening ? 20 : 4;
      const speed = isPlaying ? 0.08 : isListening ? 0.05 : 0.015;

      phase += speed;

      // Draw 3 delicate harmonic luxury waves
      const waves = [
        { color: 'rgba(163, 131, 91, 0.75)', ampScale: 1.0, freq: 0.018, offset: 0 },
        { color: 'rgba(31, 29, 26, 0.45)', ampScale: 0.7, freq: 0.024, offset: Math.PI / 3 },
        { color: 'rgba(197, 168, 128, 0.40)', ampScale: 0.5, freq: 0.012, offset: Math.PI / 1.5 },
      ];

      waves.forEach((wave) => {
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = wave.color;

        const centerY = height / 2;

        for (let x = 0; x < width; x++) {
          // Windowing envelope to taper edges smoothly
          const envelope = Math.sin((x / width) * Math.PI);
          const y =
            centerY +
            Math.sin(x * wave.freq + phase + wave.offset) *
              targetAmp *
              wave.ampScale *
              envelope;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, isListening]);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={360}
        height={70}
        className="w-full max-w-sm h-16 pointer-events-none"
      />
    </div>
  );
};
