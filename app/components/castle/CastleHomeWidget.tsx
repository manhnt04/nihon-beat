import React from 'react';
import { Map as MapIcon, Shield, Sparkles, ChevronRight } from 'lucide-react';

export interface CastleHomeWidgetProps {
  castle: {
    wood: number;
    ink: number;
    shieldActiveUntil: number;
    theme: string;
    buildings: { main: number; library: number; listening: number };
  } | null;
  coins: number;
  streak: number;
  discoveriesCount: number;
  extraBuildingsCount: number;
  extraProsperity: number;
  onNavigateCastle: () => void;
  harvestAvailable?: { wood: number; ink: number; coins: number };
  onHarvest?: () => void;
}

export const CastleHomeWidget: React.FC<CastleHomeWidgetProps> = ({
  castle,
  coins,
  streak,
  discoveriesCount,
  extraBuildingsCount,
  extraProsperity,
  onNavigateCastle,
  harvestAvailable,
  onHarvest,
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentCastle = castle ?? {
    wood: 0,
    ink: 0,
    shieldActiveUntil: 0,
    theme: 'classic',
    buildings: { main: 1, library: 1, listening: 1 },
  };

  const castleLevel = Math.max(
    1,
    Object.values(currentCastle.buildings).reduce((sum, level) => sum + level, 0) - 2
  );

  const prosperity =
    castleLevel * 250 +
    discoveriesCount * 5 +
    streak * 20 +
    extraProsperity;

  const castleTitle =
    castleLevel >= 25
      ? '汉字圣殿 · Thánh Điện Hán Tự'
      : castleLevel >= 18
      ? '王城 · Vương Thành'
      : castleLevel >= 10
      ? '书院城 · Thành Học Viện'
      : castleLevel >= 5
      ? '小院 · Tiểu Viện'
      : '茅屋 · Thảo Đường';

  const isShieldActive = mounted && currentCastle.shieldActiveUntil > Date.now();
  const shieldHoursLeft = isShieldActive
    ? Math.max(1, Math.ceil((currentCastle.shieldActiveUntil - Date.now()) / (1000 * 60 * 60)))
    : 0;

  const hasHarvest = mounted && Boolean(harvestAvailable && (harvestAvailable.wood > 0 || harvestAvailable.ink > 0));

  return (
    <section className="home-castle-card" aria-label="Hán Tự Thành">
      <div className="home-castle-left">
        <div className="home-castle-badge-icon">
          <span className="home-castle-chinese-seal">城</span>
          <b className="home-castle-level-pill">Lv.{castleLevel}</b>
        </div>
      </div>

      <div className="home-castle-center">
        <div className="home-castle-header">
          <span className="home-castle-eyebrow">
            <MapIcon size={13} />
            HÁN TỰ THÀNH · 汉字城池
          </span>
          <span className="home-castle-prosperity-chip" title="Điểm Phồn Vinh tổng cộng">
            <Sparkles size={12} />
            繁荣度 {prosperity.toLocaleString('vi-VN')}
          </span>
        </div>

        <h3 className="home-castle-title">{castleTitle}</h3>
        <p className="home-castle-desc">
          Mở rộng bờ cõi đảo 12×12, tu bổ Thư Các và Thính Âm Các để nhận phúc lợi học tập.
          {extraBuildingsCount > 0 && ` (${extraBuildingsCount} công trình ngoại viện)`}
        </p>

        <div className="home-castle-resources-row">
          <span className="home-castle-res-chip" title="Gỗ xây dựng">
            🪵 <b>{currentCastle.wood.toLocaleString('vi-VN')}</b>
          </span>
          <span className="home-castle-res-chip" title="Mực điển tích">
            🖌 <b>{currentCastle.ink.toLocaleString('vi-VN')}</b>
          </span>
          <span className="home-castle-res-chip" title="Coin xây thành">
            🪙 <b>{coins.toLocaleString('vi-VN')}</b>
          </span>
          <span
            className={`home-castle-shield-chip ${isShieldActive ? 'active' : 'inactive'}`}
            title={isShieldActive ? `Khiên bảo vệ còn ${shieldHoursLeft} giờ` : 'Khiên chưa kích hoạt'}
          >
            <Shield size={12} />
            {isShieldActive ? `Bảo hộ: ${shieldHoursLeft}h` : 'Chưa mở khiên'}
          </span>
        </div>
      </div>

      <div className="home-castle-actions">
        {hasHarvest && onHarvest && harvestAvailable && (
          <button
            type="button"
            className="home-castle-harvest-btn"
            onClick={onHarvest}
            title="Thu hoạch tài nguyên nhàn rỗi tích lũy"
          >
            <i>🌾</i>
            <span>Thu Hoạch (+{harvestAvailable.wood}🪵, +{harvestAvailable.ink}🖌)</span>
          </button>
        )}
        <button
          type="button"
          className="home-castle-cta-btn"
          onClick={onNavigateCastle}
        >
          <span>Vào Thành Trì</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
};

export default CastleHomeWidget;
