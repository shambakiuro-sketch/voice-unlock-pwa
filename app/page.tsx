'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://snvhlgnjzvdqvqbdrhyh.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not found. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// COLORS - LASUASA BRANDING
// ============================================================================
const COLORS = {
  darkGreen: '#1a4d2e',
  darkerGreen: '#122f1c',
  gold: '#C9A84C',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  darkGray: '#333333',
  error: '#DC3545',
  success: '#28A745',
};

// ============================================================================
// VOICE FINGERPRINTER
// ============================================================================
class VoiceFingerprinter {
  static extractFeatures(audioBuffer: Float32Array) {
    if (!audioBuffer || audioBuffer.length === 0) return null;

    const features = [];
    const frameSize = 512;
    const hopSize = 256;

    for (let i = 0; i < audioBuffer.length - frameSize; i += hopSize) {
      const frame = audioBuffer.slice(i, i + frameSize);
      features.push({
        energy: this.calculateEnergy(frame),
        zcr: this.calculateZCR(frame),
        mean: this.calculateMean(frame),
        variance: this.calculateVariance(frame),
      });
    }

    const summary = {
      avgEnergy: features.reduce((a, b) => a + b.energy, 0) / features.length,
      avgZCR: features.reduce((a, b) => a + b.zcr, 0) / features.length,
      avgMean: features.reduce((a, b) => a + b.mean, 0) / features.length,
      avgVariance: features.reduce((a, b) => a + b.variance, 0) / features.length,
    };

    return { features, summary };
  }

  static calculateEnergy(frame: Float32Array): number {
    return frame.reduce((sum, val) => sum + val * val, 0) / frame.length;
  }

  static calculateZCR(frame: Float32Array): number {
    let zc = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0 && frame[i - 1] < 0) || (frame[i] < 0 && frame[i - 1] >= 0)) {
        zc++;
      }
    }
    return zc / frame.length;
  }

  static calculateMean(frame: Float32Array): number {
    return frame.reduce((a, b) => a + b, 0) / frame.length;
  }

  static calculateVariance(frame: Float32Array): number {
    const mean = this.calculateMean(frame);
    return frame.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / frame.length;
  }

  static compareFingerprints(fp1: any, fp2: any, threshold = 0.85): number {
    if (!fp1 || !fp2) return 0;

    const s1 = fp1.summary;
    const s2 = fp2.summary;

    const energyDiff = Math.abs(s1.avgEnergy - s2.avgEnergy) / Math.max(s1.avgEnergy, s2.avgEnergy, 0.001);
    const zcrDiff = Math.abs(s1.avgZCR - s2.avgZCR) / Math.max(s1.avgZCR, 0.001);
    const meanDiff = Math.abs(s1.avgMean - s2.avgMean) / Math.max(Math.abs(s1.avgMean), Math.abs(s2.avgMean), 0.001);

    const similarity = 1 - (energyDiff * 0.4 + zcrDiff * 0.3 + meanDiff * 0.3) / 3;
    return Math.max(0, Math.min(1, similarity));
  }
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function VoiceUnlockApp() {
  const [screen, setScreen] = useState<'home' | 'enroll' | 'verify' | 'success'>('home');
  const [userId, setUserId] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingCount, setRecordingCount] = useState(0);
  const [recordings, setRecordings] = useState<Blob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationScore, setVerificationScore] = useState(0);
  const [voiceProfileExists, setVoiceProfileExists] = useState(false);
  const [error, setError] = useState('');
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<AudioNode | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);

  useEffect(() => {
    initializeApp();

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const initializeApp = async () => {
    try {
      let storedUserId = localStorage.getItem('voiceUnlockUserId');
      if (!storedUserId) {
        storedUserId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('voiceUnlockUserId', storedUserId);
      }
      setUserId(storedUserId);

      const { data } = await supabase
        .from('voice_profiles')
        .select('id')
        .eq('user_id', storedUserId)
        .single();

      if (data) {
        setVoiceProfileExists(true);
      }
    } catch (error) {
      console.log('No existing voice profile');
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      setIsRecording(true);
      recordedChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        recordedChunksRef.current.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      setError('Microphone access denied. Please enable microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!audioContextRef.current || !mediaStreamRef.current || !processorRef.current) return;

    try {
      setIsRecording(false);

      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      processorRef.current.disconnect();
      audioContextRef.current.close();

      const totalLength = recordedChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      const audioBuffer = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of recordedChunksRef.current) {
        audioBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const audioBlob = floatTo16BitPCM(audioBuffer);
      setRecordings([...recordings, audioBlob]);
      setRecordingCount(recordingCount + 1);
    } catch (err) {
      setError('Failed to stop recording');
    }
  };

  const completeEnrollment = async () => {
    if (recordingCount < 5) {
      setError('Please record all 5 samples');
      return;
    }

    setIsLoading(true);
    try {
      const fingerprints = [];
      for (const blob of recordings) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const channelData = audioBuffer.getChannelData(0);
        const fingerprint = VoiceFingerprinter.extractFeatures(channelData);
        if (fingerprint) fingerprints.push(fingerprint);
      }

      const voiceProfile = {
        user_id: userId,
        passphrase: 'Themis Vanguard',
        voice_fingerprint: btoa(JSON.stringify(fingerprints)),
        confidence_threshold: 0.85,
      };

      const { error } = await supabase.from('voice_profiles').insert([voiceProfile]);

      if (error) throw error;

      setVoiceProfileExists(true);
      setRecordings([]);
      setRecordingCount(0);
      setScreen('home');
    } catch (err) {
      setError('Failed to save voice profile: ' + (err as any).message);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyVoice = async () => {
    if (recordingCount === 0) {
      setError('Please record your voice first');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('voice_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!data) throw new Error('Voice profile not found');

      const currentBlob = recordings[0];
      const arrayBuffer = await currentBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const currentFingerprint = VoiceFingerprinter.extractFeatures(audioBuffer.getChannelData(0));

      const storedFingerprints = JSON.parse(atob(data.voice_fingerprint));
      let bestScore = 0;

      for (const stored of storedFingerprints) {
        const score = VoiceFingerprinter.compareFingerprints(currentFingerprint, stored);
        bestScore = Math.max(bestScore, score);
      }

      setVerificationScore(bestScore);

      if (bestScore >= 0.85) {
        setScreen('success');
        setTimeout(() => setScreen('verify'), 3000);
      } else {
        setError(`Verification failed. Score: ${(bestScore * 100).toFixed(0)}%. Try again.`);
      }
    } catch (err) {
      setError('Verification failed: ' + (err as any).message);
    } finally {
      setIsLoading(false);
      setRecordings([]);
      setRecordingCount(0);
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  // HOME SCREEN
  if (screen === 'home') {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>Voice Unlock</div>
          <div style={styles.subtitle}>🎤 Themis Vanguard</div>
        </div>

        <div style={styles.micIcon}>🎤</div>

        <div style={styles.description}>
          Unlock your device with your unique voice
        </div>

        {isInstallable && (
          <button style={{ ...styles.button, backgroundColor: COLORS.gold, color: COLORS.darkGreen, marginBottom: 12 }} onClick={handleInstall}>
            📱 Install App
          </button>
        )}

        {!voiceProfileExists ? (
          <>
            <button style={styles.button} onClick={() => { setRecordings([]); setRecordingCount(0); setScreen('enroll'); }}>
              Enroll Your Voice
            </button>
            <div style={styles.helperText}>
              Record 5 samples saying "Themis Vanguard" to set up your voice unlock
            </div>
          </>
        ) : (
          <>
            <button style={styles.button} onClick={() => { setRecordings([]); setRecordingCount(0); setScreen('verify'); }}>
              🔓 Unlock Device
            </button>
            <button style={{ ...styles.button, backgroundColor: COLORS.lightGray, color: COLORS.darkGreen, border: `2px solid ${COLORS.darkGreen}` }} onClick={() => { setRecordings([]); setRecordingCount(0); setScreen('enroll'); }}>
              Re-enroll Voice
            </button>
          </>
        )}

        <div style={styles.infoBox}>
          <div style={styles.infoTitle}>About Voice Unlock</div>
          <div style={styles.infoText}>
            • Your voice is unique and cannot be easily replicated<br/>
            • Requires clear audio for best results<br/>
            • Keep passphrase confidential<br/>
            • Re-enroll if voice changes
          </div>
        </div>
      </div>
    );
  }

  // ENROLLMENT SCREEN
  if (screen === 'enroll') {
    return (
      <div style={styles.container}>
        <button style={styles.backButton} onClick={() => { setScreen('home'); setRecordings([]); setRecordingCount(0); }}>
          ← Back
        </button>

        <div style={{ ...styles.title, marginTop: 20 }}>Enroll Your Voice</div>
        <div style={styles.subtitle}>Say "Themis Vanguard" {recordingCount}/5 times</div>

        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${(recordingCount / 5) * 100}%` }}></div>
        </div>

        <div style={styles.recordingList}>
          {[1, 2, 3, 4, 5].map((num) => (
            <div key={num} style={styles.recordingItem}>
              <span>{num}</span>
              <span style={{ color: recordingCount >= num ? COLORS.success : '#999' }}>
                {recordingCount >= num ? '✓ Recorded' : 'Pending'}
              </span>
            </div>
          ))}
        </div>

        <button
          style={{
            ...styles.recordButton,
            transform: isRecording ? 'scale(1.1)' : 'scale(1)',
          }}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading || recordingCount >= 5}
        >
          {isRecording ? '⏹ STOP' : '● RECORD'}
        </button>

        {recordingCount >= 5 && (
          <button style={styles.button} onClick={completeEnrollment} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Complete Enrollment'}
          </button>
        )}

        {error && <div style={styles.error}>{error}</div>}
      </div>
    );
  }

  // VERIFICATION SCREEN
  if (screen === 'verify') {
    return (
      <div style={styles.container}>
        <button style={styles.backButton} onClick={() => setScreen('home')}>
          ← Back
        </button>

        <div style={{ ...styles.title, marginTop: 20 }}>Verify Your Voice</div>
        <div style={styles.subtitle}>Say "Themis Vanguard" to unlock</div>

        <div style={styles.micIcon}>🎤</div>

        <button
          style={styles.verifyButton}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isLoading}
        >
          {isRecording ? '⏹ STOP' : '🎤 TAP TO RECORD'}
        </button>

        {recordingCount > 0 && (
          <button style={styles.button} onClick={verifyVoice} disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify Voice'}
          </button>
        )}

        {verificationScore > 0 && (
          <div style={styles.scoreBox}>
            <div style={styles.scoreLabel}>Match Score</div>
            <div style={styles.scoreValue}>{(verificationScore * 100).toFixed(0)}%</div>
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}
      </div>
    );
  }

  // SUCCESS SCREEN
  if (screen === 'success') {
    return (
      <div style={{ ...styles.container, backgroundColor: COLORS.darkGreen, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: COLORS.white }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>🔓</div>
          <div style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>Device Unlocked</div>
          <div style={{ fontSize: 16, color: COLORS.gold, marginBottom: 16 }}>Voice verification successful</div>
          <div style={{ fontSize: 24, fontWeight: 'bold', color: COLORS.gold }}>
            {(verificationScore * 100).toFixed(0)}% Match
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function floatTo16BitPCM(float32Array: Float32Array): Blob {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    let sample = Math.max(-1, Math.min(1, float32Array[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    int16Array[i] = Math.floor(sample);
  }
  return new Blob([int16Array], { type: 'audio/wav' });
}

// ============================================================================
// STYLES
// ============================================================================

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: COLORS.white,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.darkGreen,
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gold,
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: '0.5px',
  },
  micIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.lightGray,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 60,
    marginVertical: 32,
    border: `3px solid ${COLORS.gold}`,
  },
  description: {
    fontSize: 16,
    color: COLORS.darkGreen,
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
    lineHeight: '24px',
    maxWidth: 400,
  },
  button: {
    backgroundColor: COLORS.darkGreen,
    color: COLORS.white,
    padding: '14px 24px',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    marginBottom: 12,
    width: '100%',
    maxWidth: 400,
    transition: 'all 0.3s ease',
  },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.darkGreen,
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    marginBottom: 32,
    transition: 'transform 0.3s ease',
  },
  verifyButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.gold,
    color: COLORS.darkGreen,
    fontSize: 16,
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    marginBottom: 32,
    transition: 'all 0.3s ease',
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    color: COLORS.darkGreen,
    fontSize: 16,
    fontWeight: '600',
    border: 'none',
    cursor: 'pointer',
    padding: '10px 0',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 400,
  },
  infoBox: {
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 8,
    marginTop: 32,
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    borderLeftColor: COLORS.gold,
    maxWidth: 400,
    width: '100%',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.darkGreen,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: '20px',
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.lightGray,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 32,
    width: '100%',
    maxWidth: 400,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  recordingList: {
    marginBottom: 32,
    width: '100%',
    maxWidth: 400,
  },
  recordingItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  scoreBox: {
    backgroundColor: COLORS.lightGray,
    padding: 20,
    borderRadius: 8,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 400,
    width: '100%',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.darkGreen,
  },
  error: {
    backgroundColor: '#ffe0e0',
    color: COLORS.error,
    padding: '12px 16px',
    borderRadius: 8,
    marginTop: 16,
    fontSize: 14,
    maxWidth: 400,
    width: '100%',
  },
};
