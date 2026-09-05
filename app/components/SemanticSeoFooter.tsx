import React from 'react';
import { SEO_FEATURES, FAQ_ITEMS, SEO_LEARNING_METHOD } from '@/lib/seo-data';

export default function SemanticSeoFooter() {
  return (
    <section className="seo-landing-content" aria-label="Giới thiệu Hanzi Beat">
      <div className="seo-container">
        <header className="seo-header">
          <span className="seo-badge">NỀN TẢNG GAMIFICATION HỌC TIẾNG TRUNG</span>
          <h1 className="seo-main-title">
            Hanzi Beat — Game Nhịp Điệu Luyện Gõ Hán Tự &amp; Thi Đấu Tiếng Trung Online
          </h1>
          <p className="seo-lead">
            <strong>Hanzi Beat</strong> là nền tảng học tiếng Trung gamification đột phá,
            kết hợp giữa trò chơi nhịp điệu (Rhythm Game) và phương pháp ghi nhớ mặt chữ
            lặp lại ngắt quãng (Spaced Repetition).
          </p>
        </header>

        <section className="seo-features-section">
          <h2 className="seo-section-heading">Tại sao học chữ Hán qua Hanzi Beat lại nhớ lâu hơn 300%?</h2>
          <div className="seo-features-grid">
            {SEO_FEATURES.map((feature, idx) => (
              <article key={idx} className="seo-feature-card">
                <div className="seo-feature-icon">{feature.icon}</div>
                <h3 className="seo-feature-title">{feature.title}</h3>
                <p className="seo-feature-desc">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="seo-method-section">
          <h2 className="seo-section-heading">{SEO_LEARNING_METHOD.heading}</h2>
          <div className="seo-method-card">
            {SEO_LEARNING_METHOD.paragraphs.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </section>

        <section className="seo-faq-section">
          <h2 className="seo-section-heading">Câu Hỏi Thường Gặp (FAQ)</h2>
          <p className="seo-faq-intro">
            Giải đáp những thắc mắc thường gặp về phương pháp luyện gõ bính âm, kho từ vựng HSK và cách chơi Hanzi Beat.
          </p>
          <div className="seo-faq-list">
            {FAQ_ITEMS.map((item, idx) => (
              <details key={idx} className="seo-faq-item">
                <summary className="seo-faq-question">
                  <span>{item.question}</span>
                  <span className="seo-faq-chevron" aria-hidden="true">▾</span>
                </summary>
                <div className="seo-faq-answer">
                  <p>{item.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <footer className="seo-bottom-bar">
          <div className="seo-brand-info">
            <span className="seo-brand-mark">漢韵 · HANZI BEAT</span>
            <small>© 2026 Hanzi Beat. Nền tảng học Hán tự qua âm nhạc &amp; Tiên Đảo 2.5D. All rights reserved.</small>
          </div>
          <div className="seo-tags-list">
            <span className="seo-tag">#GameHocTiengTrung</span>
            <span className="seo-tag">#LuyenGoPinyin</span>
            <span className="seo-tag">#HSK1_4</span>
            <span className="seo-tag">#PvpTiengTrung</span>
          </div>
        </footer>
      </div>
    </section>
  );
}
