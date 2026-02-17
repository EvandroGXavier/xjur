import React, { useState, useRef, useEffect } from 'react';
import { Mic, Trash2, Send } from 'lucide-react';

interface AudioRecorderProps {
  onSend: (audioBlob: Blob) => void;
  onCancel: () => void;
}

export function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      // alert("Erro ao acessar o microfone. Verifique as permissões."); // Removed annoyances
      onCancel();
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
         // Stop all tracks to release mic
         if (mediaRecorderRef.current?.stream) {
             mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
         }

         if (shouldSend) {
             // Create blob
             const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
             onSend(blob);
         } else {
             onCancel();
         }
      };

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
        // Fallback if not started properly
        onCancel();
    }
  };

  // Start immediately on mount
  useEffect(() => {
    startRecording();
    return () => {
      // Cleanup
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 flex-1 bg-slate-800 rounded-xl px-4 py-2 border border-red-500/30 animate-pulse-subtle shadow-inner">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2" />
      <span className="text-red-400 text-sm font-mono min-w-[50px] font-bold">Gravo: {formatTime(recordingTime)}</span>
      <div className="flex-1 text-xs text-slate-500 text-center">Gravando áudio...</div>
      
      <button 
        onClick={() => stopRecording(false)}
        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-full transition"
        title="Cancelar e descartar"
      >
        <Trash2 size={20} />
      </button>

      <button 
        onClick={() => stopRecording(true)}
        className="p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/20 transform hover:scale-105"
        title="Enviar Áudio"
      >
        <Send size={20} />
      </button>
    </div>
  );
}
