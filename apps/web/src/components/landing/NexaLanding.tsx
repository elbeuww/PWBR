import { getTranslations, getLocale } from 'next-intl/server'

import { Link } from '../../i18n/navigation'
import { NexaGlobe } from './NexaGlobe'
import { NexaLandingEffects } from './NexaLandingEffects'

/**
 * NexaLanding — vitrine NEXA, port FIDÈLE de la maquette (design borhane).
 *
 * Rendu RSC du markup sombre premium (nav, hero globe + data-rain + cartes, marquee,
 * étapes sticky, jauge, carte démo tilt, pricing, Telegram, footer), scopé sous
 * `.nxl` (nxl.css). Thème GREEN unique du DS v3 (data-theme="green" figé, plus de
 * toggle Green/Volt — Phase 16). Texte 100% i18n next-intl (fr/en/ar). Animations = NexaLandingEffects
 * (vanilla, reduced-motion). Marque NEXA, aucune promesse de gain, % jamais inventé
 * (rings colorés par RISQUE, jauge = score d'exemple, pas un taux de réussite).
 */
type Card = { instrument: string; direction: string; score: number; risk: string; riskLabel: string }

const RING_C = 2 * Math.PI * 18
const RISK_STROKE: Record<string, string> = {
  faible: 'var(--sub)',
  modere: 'var(--warn)',
  eleve: 'var(--sell)',
}

function Ring({ score, risk, ariaLabel }: { score: number; risk: string; ariaLabel: string }) {
  const dash = (Math.max(0, Math.min(100, score)) / 100) * RING_C
  return (
    <div className="score-ring" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={ariaLabel}>
      <svg width={46} height={46} viewBox="0 0 46 46" aria-hidden>
        <circle className="rt" cx={23} cy={23} r={18} />
        <circle className="rv" cx={23} cy={23} r={18} stroke={RISK_STROKE[risk] ?? 'var(--sub)'} strokeDasharray={`${dash.toFixed(1)} ${RING_C.toFixed(1)}`} />
      </svg>
      <span className="rn" style={{ color: 'var(--text)' }}><bdi>{score}</bdi></span>
    </div>
  )
}

const BRAND_SVG = (
  <svg width={18} height={18} viewBox="0 0 30 30" fill="none" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 19l5-6 4 4 9-11" />
    <path d="M24 6v6h-6" />
  </svg>
)

export async function NexaLanding() {
  const locale = await getLocale()
  const [tNav, tHero, tH, tHow, tScore, tDemo, tPrice, tPricing, tTg, tFoot, tMarquee, tScoreRing] = await Promise.all([
    getTranslations('landing.nav'), getTranslations('landing.hero'), getTranslations('hero'),
    getTranslations('landing.how'), getTranslations('landing.score'), getTranslations('landing.demo'),
    getTranslations('landing.pricing'), getTranslations('pricing'), getTranslations('landing.telegram'),
    getTranslations('landing.footer'), getTranslations('marquee'), getTranslations('scoreRing'),
  ])
  const cards = tH.raw('cards') as Card[]
  const marqueeItems = tMarquee.raw('items') as string[]
  const ariaFor = (c: Card) => tScoreRing('ariaTemplate', { score: c.score, risk: c.riskLabel })
  const langs: Array<[string, string]> = [['fr', 'FR'], ['en', 'EN'], ['ar', 'AR']]
  // Translation JSON guarantees ≥2 card entries; !-assert to satisfy noUncheckedIndexedAccess.
  const card0 = cards[0]!
  const card1 = cards[1]!

  return (
    <div className="nxl" data-theme="green">
      <NexaLandingEffects />
      <div className="nxl-progress" aria-hidden />

      {/* NAV */}
      <nav className="nx-nav">
        <div className="wrap nav-inner">
          <a className="brand" href="#top"><span className="mark-tile">{BRAND_SVG}</span><span className="word">NEX<b>A</b></span></a>{/* i18n-ignore autonyme marque NEXA */}
          <div className="nav-links">
            <a href="#how">{tNav('how')}</a>
            <a href="#score">{tNav('score')}</a>
            <a href="#pricing">{tNav('pricing')}</a>
            <a href="#telegram">{tNav('telegram')}</a>
          </div>
          <div className="nav-spacer" />
          <div className="lang-switch">
            {langs.map(([loc, lbl]) => (
              <Link key={loc} href="/" locale={loc} data-active={locale === loc ? '1' : '0'}>{lbl}</Link>
            ))}
          </div>
          <Link className="btn btn-ghost btn-sm" href="/login">{tNav('login')}</Link>
          <Link className="btn btn-primary btn-sm" href="/signup">{tNav('start')}</Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero" id="top">
        <div className="hero-aura" aria-hidden />
        <div className="hero-grid" aria-hidden />
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <span className="eyebrow"><span className="dot" aria-hidden />{tHero('eyebrow')}</span>
            <h1>{tH('title')}</h1>
            <p className="lede">{tH('lede')}</p>
            <div className="hero-cta">
              <Link className="btn btn-primary" href="/tarifs">{tHero('cta1')}</Link>
              <a className="btn btn-ghost" href="#how">{tHero('cta2')}</a>
            </div>
            <div className="hero-trust">
              <div className="stat"><div className="n"><bdi>{tHero('trust1Value')}</bdi></div><div className="l">{tHero('trust1Label')}</div></div>
              <div className="stat"><div className="n"><bdi>{tHero('trust2Value')}</bdi></div><div className="l">{tHero('trust2Label')}</div></div>
              <div className="stat"><div className="n"><bdi>{tHero('trust3Value')}</bdi></div><div className="l">{tHero('trust3Label')}</div></div>
            </div>
          </div>

          {/* SCÈNE : globe + data-rain + cartes flottantes */}
          <div className="scene">
            <div className="data-rain" id="dataRain" aria-hidden />
            <div className="globe-wrap layer" data-depth="0.35" aria-hidden><div className="atmo" /><NexaGlobe /></div>
            <div className="layer float-card" data-depth="1.6" style={{ insetBlockStart: '4%', insetInlineStart: '-4%', zIndex: 3 }}>
              <div className="fc-top"><span className="fc-sym"><bdi>{card0.instrument}</bdi></span><span className={`fc-dir ${card0.risk === 'eleve' ? 'sell' : 'buy'}`}>{card0.direction}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBlockStart: 6 }}>
                <div className="fc-score" style={{ color: 'var(--primary)' }}><bdi>{card0.score}</bdi></div>
                <Ring score={card0.score} risk={card0.risk} ariaLabel={ariaFor(card0)} />
              </div>
            </div>
            <div className="layer float-card" data-depth="2.1" style={{ insetBlockEnd: '6%', insetInlineEnd: '-6%', zIndex: 3 }}>
              <div className="fc-top"><span className="fc-sym"><bdi>{card1.instrument}</bdi></span><span className={`fc-dir ${card1.risk === 'eleve' ? 'sell' : 'buy'}`}>{card1.direction}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBlockStart: 6 }}>
                <div className="fc-score" style={{ color: 'var(--text)' }}><bdi>{card1.score}</bdi></div>
                <Ring score={card1.score} risk={card1.risk} ariaLabel={ariaFor(card1)} />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MARQUEE */}
      <div className="marquee" role="marquee" aria-label={tMarquee('label')}>
        <div className="marquee-track">
          {[...marqueeItems, ...marqueeItems].map((it, i) => (
            <span className="tick" key={i} aria-hidden={i >= marqueeItems.length}><b><bdi>{it}</bdi></b></span>
          ))}
        </div>
      </div>

      {/* HOW */}
      <section className="block" id="how">
        <div className="wrap">
          <div className="reveal">
            <div className="sec-eyebrow">{tHow('eyebrow')}</div>
            <h2 className="sec-title">{tHow('title')}</h2>
            <p className="sec-lede">{tHow('lede')}</p>
          </div>
          <div className="steps" style={{ marginBlockStart: 56 }}>
            <div className="steps-sticky reveal d1">
              <div className="mock tilt" data-tilt="6">
                <div className="mock-sub" style={{ marginBlockEnd: 10 }}>{tHow('mockLabel')}</div>
                {cards.map((c, i) => (
                  <div className="mock-row" key={i}>
                    <div><div className="mock-sym"><bdi>{c.instrument}</bdi></div><div className="mock-sub">{c.direction} · {c.riskLabel}</div></div>
                    <Ring score={c.score} risk={c.risk} ariaLabel={ariaFor(c)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="steps-list">
              {[1, 2, 3].map((n) => (
                <div className="step reveal" key={n}>
                  <div className="num">{`0${n}`}</div>
                  <h3>{tHow(`step${n}Title`)}</h3>
                  <p>{tHow(`step${n}Body`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SCORE */}
      <section className="block" id="score" style={{ background: 'var(--bg2)', borderBlock: '1px solid var(--line-soft)' }}>
        <div className="wrap score-feature">
          <div className="reveal">
            <div className="gauge-big" data-score="78">
              <svg width={280} height={280} viewBox="0 0 100 100">
                <circle className="gt" cx={50} cy={50} r={43} />
                <circle className="gv" cx={50} cy={50} r={43} stroke="var(--warn)" strokeDasharray="0 270" />
              </svg>
              <div className="center"><div className="gnum" style={{ color: 'var(--warn)' }}><bdi>{78}</bdi></div><div className="glbl">{tScore('exampleLabel')}</div></div>
            </div>
          </div>
          <div className="reveal d1">
            <div className="sec-eyebrow">{tScore('eyebrow')}</div>
            <h2 className="sec-title">{tScore('title')}</h2>
            <p className="sec-lede">{tScore('lede')}</p>
            <div style={{ display: 'flex', gap: 30, marginBlockStart: 30, flexWrap: 'wrap' }}>
              {[1, 2, 3].map((n) => (
                <div key={n}><div className="mono" style={{ fontWeight: 700, fontSize: 26, color: n === 1 ? 'var(--primary)' : 'var(--text)' }}><bdi>{tScore(`stat${n}Value`)}</bdi></div><div style={{ color: 'var(--sub)', fontSize: 13, marginBlockStart: 2 }}>{tScore(`stat${n}Label`)}</div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SIGNAL DEMO */}
      <section className="block">
        <div className="wrap">
          <div className="reveal" style={{ textAlign: 'center', maxInlineSize: 620, marginInline: 'auto', marginBlockEnd: 44 }}>
            <div className="sec-eyebrow">{tDemo('eyebrow')}</div>
            <h2 className="sec-title">{tDemo('title')}</h2>
          </div>
          <div className="reveal d1" style={{ maxInlineSize: 680, marginInline: 'auto' }}>
            <div className="signal-demo tilt" data-tilt="7">
              <div className="sd-head">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 19 }}><bdi>{tDemo('instrument')}</bdi></div>
                  <div className="mock-sub" style={{ marginBlockStart: 2 }}>{tDemo('meta')}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span className="fc-dir buy" style={{ fontSize: 11, padding: '6px 11px' }}>{tDemo('direction')}</span>
                  <Ring score={92} risk="faible" ariaLabel={tDemo('ariaScore')} />
                </div>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--sub)', marginBlockStart: 14 }}>{tDemo('note')}</div>
              <div className="sd-levels">
                <div><div className="k">{tDemo('kEntry')}</div><div className="v"><bdi>{tDemo('vEntry')}</bdi></div></div>
                <div><div className="k">{tDemo('kStop')}</div><div className="v" style={{ color: 'var(--sell)' }}><bdi>{tDemo('vStop')}</bdi></div></div>
                <div><div className="k">{tDemo('kTargets')}</div><div className="v" style={{ color: 'var(--buy)' }}><bdi>{tDemo('vTargets')}</bdi></div></div>
                <div><div className="k">{tDemo('kRr')}</div><div className="v" style={{ color: 'var(--primary)' }}><bdi>{tDemo('vRr')}</bdi></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="block" id="pricing" style={{ background: 'var(--bg2)', borderBlockStart: '1px solid var(--line-soft)' }}>
        <div className="wrap">
          <div className="reveal" style={{ textAlign: 'center', maxInlineSize: 600, marginInline: 'auto' }}>
            <div className="sec-eyebrow">{tPrice('eyebrow')}</div>
            <h2 className="sec-title">{tPrice('title')}</h2>
            <p className="sec-lede" style={{ marginInline: 'auto', marginBlockStart: 16 }}>{tPrice('lede')}</p>
          </div>
          <div className="price-grid">
            <div className="price-card tilt reveal d1" data-tilt="5">
              <div className="price-name">{tPricing('plan2Title')}</div>
              <div className="price-amt"><bdi>{tPricing('plan2Price')}</bdi></div>
              <div className="price-usdt">{tPricing('plan2Note')}</div>
              <ul className="price-feats">
                {['feat1', 'feat2', 'feat3'].map((k) => (
                  <li key={k}><span className="ck" aria-hidden>›</span><span>{tPrice(k)}</span></li>
                ))}
              </ul>
              <Link className="btn btn-ghost" href="/tarifs" style={{ inlineSize: '100%', justifyContent: 'center' }}>{tPrice('discoveryCta')}</Link>
            </div>
            <div className="price-card popular tilt reveal d2" data-tilt="5">
              <span className="price-badge">{tPrice('popularBadge')}</span>
              <div className="price-name">{tPricing('plan1Title')}</div>
              <div className="price-amt"><bdi>{tPricing('plan1Price')}</bdi></div>
              <div className="price-usdt">{tPricing('plan1Usdt')}</div>
              <ul className="price-feats">
                {['feat1', 'feat2', 'feat3', 'feat4'].map((k) => (
                  <li key={k}><span className="ck" aria-hidden>›</span><span>{tPrice(k)}</span></li>
                ))}
              </ul>
              <Link className="btn btn-primary" href="/tarifs" style={{ inlineSize: '100%', justifyContent: 'center' }}>{tPrice('standardCta')}</Link>
            </div>
          </div>
        </div>
      </section>

      {/* TELEGRAM */}
      <section className="tg-band" id="telegram">
        <div className="wrap tg-inner">
          <div className="reveal">
            <div className="sec-eyebrow">{tTg('eyebrow')}</div>
            <h2 className="sec-title" style={{ fontSize: 'clamp(26px,3vw,40px)' }}>{tTg('title')}</h2>
            <p className="sec-lede" style={{ marginBlockStart: 14 }}>{tTg('lede')}</p>
          </div>
          <div className="reveal d1" style={{ textAlign: 'center' }}>
            <Link className="btn btn-primary" href="/tarifs">{tTg('cta')}</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="nx-foot">
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <a className="brand" href="#top"><span className="mark-tile">{BRAND_SVG}</span><span className="word">NEX<b>A</b></span></a>{/* i18n-ignore autonyme marque NEXA */}
              <p style={{ color: 'var(--sub)', fontSize: 14, maxInlineSize: '32ch', marginBlockStart: 14 }}>{tFoot('tag')}</p>
            </div>
            <div className="foot-links">
              <div className="foot-col"><h4>{tFoot('col1')}</h4><a href="#how">{tNav('how')}</a><a href="#score">{tNav('score')}</a><a href="#pricing">{tNav('pricing')}</a><a href="#telegram">{tNav('telegram')}</a></div>
              <div className="foot-col"><h4>{tFoot('col2')}</h4><a href="#how">{tFoot('col2_1')}</a><a href="#how">{tFoot('col2_2')}</a><a href="#how">{tFoot('col2_3')}</a></div>
              <div className="foot-col"><h4>{tFoot('col3')}</h4>{langs.map(([loc, lbl]) => (<Link key={loc} href="/" locale={loc}>{lbl}</Link>))}</div>
            </div>
          </div>
          <p className="disclaimer">{tFoot('disclaimer')}</p>
        </div>
      </footer>
    </div>
  )
}
