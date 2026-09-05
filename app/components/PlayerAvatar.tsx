'use client';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const AVATAR_FRAMES: Record<string, { image: string; scale: number }> = {
  'frame-cinnabar': { image: '/items/shop-frame-cinnabar.png', scale: 1.44 },
  'frame-dragon': { image: '/items/shop-frame-dragon.png', scale: 1.58 },
};

type PlayerAvatarProps = {
  name?: string;
  src?: string | null;
  frame?: string | null;
  size?: number;
  status?: 'online' | 'offline';
  animated?: boolean;
  className?: string;
  fallback?: ReactNode;
};

export default function PlayerAvatar({
  name = 'Người chơi',
  src,
  frame,
  size = 40,
  status,
  animated = false,
  className = '',
  fallback,
}: PlayerAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const frameConfig = frame ? AVATAR_FRAMES[frame] : undefined;
  const initial = name.trim().slice(0, 1).toUpperCase() || '汉';

  useEffect(() => setImageFailed(false), [src]);

  return (
    <span
      className={`player-avatar ${animated ? 'is-animated' : ''} ${className}`.trim()}
      style={{ '--player-avatar-size': `${size}px` } as CSSProperties}
      role="img"
      aria-label={`Ảnh đại diện của ${name}`}
      data-frame={frame ?? 'default'}
    >
      <span className="player-avatar-crop">
        {src && !imageFailed
          ? <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
          : <span className="player-avatar-fallback" aria-hidden="true">{fallback ?? initial}</span>}
      </span>
      {frameConfig && (
        <img
          className="player-avatar-frame"
          src={frameConfig.image}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={{ '--player-frame-scale': frameConfig.scale } as CSSProperties}
        />
      )}
      {status && <span className={`player-avatar-status ${status}`} aria-hidden="true" />}
    </span>
  );
}
