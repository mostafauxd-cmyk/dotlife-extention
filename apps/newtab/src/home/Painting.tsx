/**
 * The painted side of the sign-in card, in Dia's manner: layered colour pushed about by a brush
 * filter, streaks and grain over it, a tilted browser window with میز inside, and نقطه's phone
 * beside it. The edge toward the form dissolves into grain (`dissolve.png` as a mask).
 */

const SKY = { top: "#2b2540", mid: "#6c5c8f", glow: "#e8b5cb", ground: "#1b1828", seed: 8 };

export function Painting({ step }: { step: "phone" | "code" }) {
  const { top, mid, glow, ground, seed } = SKY;
  return (
    <div className="dia-art" aria-hidden="true">
      <svg className="paint" viewBox="0 0 660 740" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="pBrush" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.006 0.02"
              numOctaves={4}
              seed={seed}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={120}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
          <filter id="pStreak">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.003 0.11"
              numOctaves={3}
              seed={seed + 1}
            />
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .6 -.18" />
          </filter>
          <filter id="pGrain">
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={4} />
            <feColorMatrix type="matrix" values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .9 0" />
          </filter>
          <linearGradient id="pSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset=".62" stopColor={mid} />
            <stop offset="1" stopColor={ground} />
          </linearGradient>
          <radialGradient id="pGlow">
            <stop offset="0" stopColor={glow} stopOpacity=".95" />
            <stop offset=".55" stopColor={glow} stopOpacity=".35" />
            <stop offset="1" stopColor={glow} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="660" height="740" fill="url(#pSky)" />
        <g filter="url(#pBrush)">
          <ellipse cx="160" cy="150" rx="300" ry="120" fill={mid} opacity=".55" />
          <ellipse cx="520" cy="250" rx="260" ry="90" fill={top} opacity=".8" />
          <ellipse cx="380" cy="640" rx="430" ry="110" fill="url(#pGlow)" />
          <rect x="-60" y="680" width="800" height="140" fill={ground} />
          <ellipse cx="90" cy="420" rx="160" ry="230" fill="#43395c" opacity=".5" />
        </g>
        <rect
          width="660"
          height="740"
          filter="url(#pStreak)"
          style={{ mixBlendMode: "soft-light" }}
        />
        <rect
          width="660"
          height="740"
          filter="url(#pGrain)"
          opacity=".5"
          style={{ mixBlendMode: "overlay" }}
        />
      </svg>
      <div className="stage" key={step}>
        <div className="phone2">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="win">
          <span className="tab" />
          <span className="bar">
            <i />
            <i />
            <i />
          </span>
          <div className="scr">
            <span className="dot2" />
            <div className="sx">
              <svg viewBox="0 0 24 24">
                <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
                <path d="M19.5 12h-7" />
              </svg>
              در گوگل جستجو کن…
            </div>
            <div className="mini">
              <span className="ping2">
                {step === "phone" ? "از گوشی · همین حالا" : "در حال وصل شدن…"}
              </span>
              <b>کارهای امروز</b>
              <span className="r">
                <i />
                زنگ به آقای رحیمی
              </span>
              <span className="r">
                <i className="ok" />
                پرداخت قبض برق
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
