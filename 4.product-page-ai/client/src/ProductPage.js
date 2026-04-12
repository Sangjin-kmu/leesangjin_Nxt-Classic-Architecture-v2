import React from "react";

export default function ProductPage({ data, template = "hero" }) {
  if (!data) return null;

  switch (template) {
    case "card": return <CardLayout data={data} />;
    case "story": return <StoryLayout data={data} />;
    default: return <HeroLayout data={data} />;
  }
}

// ===== 1. 히어로 중심형 (로지텍 스타일) =====
function HeroLayout({ data }) {
  return (
    <div className="pp hero-layout">
      <section className="hero-banner">
        <p className="hero-brand">{data.brand || ""}</p>
        <h1>{data.catchphrase}</h1>
        <p className="hero-sub">{data.subtitle}</p>
        {data.productImage
          ? <img src={data.productImage} alt="" className="hero-img" />
          : <div className="img-placeholder large">상품 이미지</div>}
      </section>

      <section className="hero-features">
        <div className="hero-features-row">
          {(data.features || []).map((f, i) => (
            <div key={i} className="hero-feat">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {(data.sections || []).map((sec, i) => (
        <section key={i} className={`hero-section ${i % 2 === 0 ? "dark" : ""}`}>
          <h2>{sec.title}</h2>
          <p>{sec.content}</p>
          <div className="img-placeholder wide">이미지</div>
        </section>
      ))}

      {data.specTable && data.specTable.length > 0 && (
        <section className="hero-specs">
          <h2>사양</h2>
          <div className="spec-grid">
            {data.specTable.map((r, i) => (
              <div key={i} className="spec-item">
                <span className="spec-label">{r.label}</span>
                <span className="spec-value">{r.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(data.price || data.priceComment) && (
        <section className="hero-cta">
          <h2>{data.priceComment || "지금 만나보세요"}</h2>
          {data.price && <p className="cta-price">{data.price}</p>}
        </section>
      )}
    </div>
  );
}

// ===== 2. 카드 그리드형 (쿠팡/아마존 스타일) =====
function CardLayout({ data }) {
  return (
    <div className="pp card-layout">
      <section className="card-top">
        <div className="card-top-left">
          {data.productImage
            ? <img src={data.productImage} alt="" className="card-main-img" />
            : <div className="img-placeholder square">상품 이미지</div>}
        </div>
        <div className="card-top-right">
          <p className="card-brand">{data.brand || ""}</p>
          <h1>{data.catchphrase}</h1>
          <p className="card-sub">{data.subtitle}</p>
          {data.price && <p className="card-price">{data.price}</p>}
        </div>
      </section>

      <section className="card-grid-section">
        <h2>주요 특징</h2>
        <div className="card-grid">
          {(data.features || []).map((f, i) => (
            <div key={i} className="info-card">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card-details">
        <h2>상세 정보</h2>
        {(data.sections || []).map((sec, i) => (
          <div key={i} className="detail-block">
            <div className="img-placeholder detail-img">이미지</div>
            <div>
              <h3>{sec.title}</h3>
              <p>{sec.content}</p>
            </div>
          </div>
        ))}
      </section>

      {data.specTable && data.specTable.length > 0 && (
        <section className="card-specs">
          <h2>제품 사양</h2>
          <table><tbody>
            {data.specTable.map((r, i) => (
              <tr key={i}><td className="sl">{r.label}</td><td>{r.value}</td></tr>
            ))}
          </tbody></table>
        </section>
      )}
    </div>
  );
}

// ===== 3. 스토리텔링형 (애플 스타일) =====
function StoryLayout({ data }) {
  return (
    <div className="pp story-layout">
      <section className="story-intro">
        <p className="story-brand">{data.brand || ""}</p>
        <h1>{data.catchphrase}</h1>
      </section>

      <section className="story-hero-img">
        {data.productImage
          ? <img src={data.productImage} alt="" className="story-img" />
          : <div className="img-placeholder cinematic">상품 이미지</div>}
        <p className="story-caption">{data.subtitle}</p>
      </section>

      {(data.features || []).map((f, i) => (
        <section key={i} className={`story-feature ${i % 2 === 0 ? "left" : "right"}`}>
          <div className="story-feature-text">
            <h2>{f.title}</h2>
            <p>{f.desc}</p>
          </div>
          <div className="img-placeholder story-feat-img">이미지</div>
        </section>
      ))}

      {(data.sections || []).map((sec, i) => (
        <section key={i} className="story-chapter">
          <h2>{sec.title}</h2>
          <p>{sec.content}</p>
        </section>
      ))}

      {data.specTable && data.specTable.length > 0 && (
        <section className="story-specs">
          <h2>사양</h2>
          <div className="story-spec-list">
            {data.specTable.map((r, i) => (
              <div key={i} className="story-spec-row">
                <span>{r.label}</span>
                <span>{r.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(data.price || data.priceComment) && (
        <section className="story-ending">
          <h2>{data.priceComment || "지금 만나보세요"}</h2>
          {data.price && <p className="story-price">{data.price}</p>}
        </section>
      )}
    </div>
  );
}
