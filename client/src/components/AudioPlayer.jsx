import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { getMemoryAudioUrl } from '../services/localDb';

function formatDuration(totalSeconds) {
  if (!totalSeconds) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ id, src, duration, isActive, setActive, clearActive }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [audioUrl, setAudioUrl] = useState(null);
  const audioRef = useRef(null);

  // Pre-resolve audio URL when src changes
  useEffect(() => {
    let isMounted = true;
    const loadUrl = async () => {
      if (src) {
        const url = await getMemoryAudioUrl(src);
        if (isMounted) {
          setAudioUrl(url);
        }
      }
    };
    loadUrl();
    return () => { isMounted = false; };
  }, [src]);

  useEffect(() => {
    // If this player becomes inactive (because another started), pause it
    if (!isActive && isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.playbackRate = playbackSpeed;
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        clearActive();
      });

      audio.addEventListener('error', (e) => {
        console.error("Audio playback error:", e);
        setIsPlaying(false);
        clearActive();
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      clearActive();
    } else {
      setActive();
      // Synchronous call inside user click handler ensures Mobile Safari & Chrome play immediately
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Playback failed:", err);
          setIsPlaying(false);
          clearActive();
        });
      } else {
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * (audioRef.current.duration || duration || 1);
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.5];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Safe duration for progress bar
  const safeDuration = (audioRef.current && audioRef.current.duration) ? audioRef.current.duration : (duration || 1);
  const progressPercent = (currentTime / safeDuration) * 100;

  return (
    <div className={`memory-player ${isPlaying ? 'is-playing' : ''}`}>
      <div className="player-controls">
        <button className="btn-play-pause" onClick={togglePlay} aria-label={isPlaying ? "Pause audio" : "Play audio"}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} style={{marginLeft: '2px'}}/>}
        </button>
        <div className="progress-container">
          {/* Animated sound wave bars preview */}
          <div className="audio-visualizer-bars">
            {[40, 75, 30, 90, 50, 85, 60, 95, 45, 70, 35, 80, 55, 90, 40, 65].map((h, idx) => (
              <span 
                key={idx} 
                className={`viz-bar ${isPlaying ? 'animating' : ''}`}
                style={{
                  height: isPlaying ? `${Math.max(20, (h * (0.4 + (idx % 5) * 0.15)) % 100)}%` : '25%',
                  animationDelay: `${(idx * 0.07).toFixed(2)}s`
                }}
              />
            ))}
          </div>

          <div className="progress-bar" onClick={handleSeek}>
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="time-display">
            <span>{formatDuration(currentTime)}</span>
            <span>{formatDuration(safeDuration !== 1 ? safeDuration : 0)}</span>
          </div>
        </div>
        <button className="btn-speed" onClick={cycleSpeed} title="Change Playback Speed">
          {playbackSpeed}x
        </button>
      </div>
    </div>
  );
}
