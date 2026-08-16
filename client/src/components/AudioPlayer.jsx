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
  const audioRef = useRef(null);

  useEffect(() => {
    // If this player becomes inactive (because another started), pause it
    if (!isActive && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [isActive]);

  const togglePlay = async () => {
    if (!audioRef.current) {
      const audioUrl = await getMemoryAudioUrl(src);
      if (!audioUrl) return;
      audioRef.current = new Audio(audioUrl);
      audioRef.current.playbackRate = playbackSpeed;
      
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current.currentTime);
      });
      
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
        clearActive();
      });
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      clearActive();
    } else {
      setActive();
      audioRef.current.play().catch(e => console.error("Playback failed", e));
      setIsPlaying(true);
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
    <div className="memory-player">
      <div className="player-controls">
        <button className="btn-play-pause" onClick={togglePlay}>
          {isPlaying ? <Pause size={16} /> : <Play size={16} style={{marginLeft: '2px'}}/>}
        </button>
        <div className="progress-container">
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
