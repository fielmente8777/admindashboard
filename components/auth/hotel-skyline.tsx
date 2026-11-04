import type { CSSProperties } from "react";

const VIEW_WIDTH = 1600;
const VIEW_HEIGHT = 500;
const WINDOW_WIDTH = 7;
const WINDOW_HEIGHT = 10;
const WINDOW_GAP_X = 7;
const WINDOW_GAP_Y = 9;
const TOWER_PADDING = 9;

interface Tower {
  x: number;
  width: number;
  height: number;
  /** A narrower block on the roof, as a share of the tower's width. */
  crown?: number;
  antenna?: boolean;
}

interface LayerStyle {
  body: string;
  dimWindow: string;
  litWindow: string;
  litChance: number;
  twinkleChance: number;
}

interface TwinklingWindow {
  x: number;
  y: number;
  delay: number;
  duration: number;
}

// Low on the left so the headline stays readable, tall on the right behind the sign-in card.
const BACK_TOWERS: Tower[] = [
  { x: 0, width: 84, height: 96 },
  { x: 98, width: 70, height: 138 },
  { x: 210, width: 96, height: 112 },
  { x: 340, width: 74, height: 168 },
  { x: 460, width: 104, height: 142 },
  { x: 610, width: 84, height: 214, crown: 0.6 },
  { x: 730, width: 112, height: 252 },
  { x: 880, width: 92, height: 318, crown: 0.5 },
  { x: 1010, width: 118, height: 286 },
  { x: 1160, width: 96, height: 372, crown: 0.6 },
  { x: 1290, width: 126, height: 330 },
  { x: 1450, width: 98, height: 398, crown: 0.5 },
  { x: 1560, width: 60, height: 300 },
];

const FRONT_TOWERS: Tower[] = [
  { x: 36, width: 112, height: 58 },
  { x: 164, width: 86, height: 88 },
  { x: 282, width: 122, height: 66 },
  { x: 432, width: 92, height: 106 },
  { x: 548, width: 128, height: 82 },
  { x: 696, width: 98, height: 148, antenna: true },
  { x: 816, width: 140, height: 118 },
  { x: 976, width: 112, height: 196, crown: 0.55 },
  { x: 1108, width: 144, height: 158 },
  { x: 1270, width: 118, height: 262, crown: 0.6, antenna: true },
  { x: 1404, width: 148, height: 196 },
  { x: 1560, width: 80, height: 232 },
];

const BACK_LAYER: LayerStyle = {
  body: "#1a2d57",
  dimWindow: "#24386a",
  litWindow: "#c98a62",
  litChance: 0.1,
  twinkleChance: 0,
};

const FRONT_LAYER: LayerStyle = {
  body: "#0b1429",
  dimWindow: "#16244a",
  litWindow: "#ffc48f",
  litChance: 0.2,
  twinkleChance: 0.07,
};

/** A small seeded generator, so the skyline is identical on every build and every visit. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function windowPath(x: number, y: number): string {
  return `M${x} ${y}h${WINDOW_WIDTH}v${WINDOW_HEIGHT}h-${WINDOW_WIDTH}z`;
}

// Windows are grouped into shared paths, so the page holds a few elements instead of thousands.
function buildLayer(towers: Tower[], style: LayerStyle, seed: number) {
  const random = seededRandom(seed);
  let body = "";
  let dim = "";
  let lit = "";
  const twinkling: TwinklingWindow[] = [];

  for (const { x, width, height, crown } of towers) {
    const top = VIEW_HEIGHT - height;
    body += `M${x} ${VIEW_HEIGHT}V${top}h${width}V${VIEW_HEIGHT}z`;
    if (crown) {
      const crownWidth = Math.round(width * crown);
      body += `M${x + Math.round((width - crownWidth) / 2)} ${top}v-22h${crownWidth}v22z`;
    }

    const columns = Math.floor((width - TOWER_PADDING * 2 + WINDOW_GAP_X) / (WINDOW_WIDTH + WINDOW_GAP_X));
    const usedWidth = columns * (WINDOW_WIDTH + WINDOW_GAP_X) - WINDOW_GAP_X;
    const left = x + Math.round((width - usedWidth) / 2);

    for (let wy = top + TOWER_PADDING; wy + WINDOW_HEIGHT < VIEW_HEIGHT; wy += WINDOW_HEIGHT + WINDOW_GAP_Y) {
      for (let column = 0; column < columns; column++) {
        const wx = left + column * (WINDOW_WIDTH + WINDOW_GAP_X);
        const roll = random();
        if (roll < style.twinkleChance) {
          dim += windowPath(wx, wy);
          twinkling.push({ x: wx, y: wy, delay: random() * 16, duration: 7 + random() * 11 });
        } else if (roll < style.twinkleChance + style.litChance) {
          lit += windowPath(wx, wy);
        } else {
          dim += windowPath(wx, wy);
        }
      }
    }
  }

  return { style, body, dim, lit, twinkling };
}

const LAYERS = [buildLayer(BACK_TOWERS, BACK_LAYER, 7), buildLayer(FRONT_TOWERS, FRONT_LAYER, 23)];
const BEACONS = FRONT_TOWERS.filter((tower) => tower.antenna);

export function HotelSkyline({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      className={className}
    >
      {LAYERS.map(({ style, body, dim, lit, twinkling }) => (
        <g key={style.body}>
          <path d={body} fill={style.body} />
          <path d={dim} fill={style.dimWindow} />
          <path d={lit} fill={style.litWindow} />
          {twinkling.map(({ x, y, delay, duration }) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={WINDOW_WIDTH}
              height={WINDOW_HEIGHT}
              fill="#fc5f07"
              className="skyline-window"
              style={
                {
                  "--window-delay": `${delay.toFixed(1)}s`,
                  "--window-duration": `${duration.toFixed(1)}s`,
                } as CSSProperties
              }
            />
          ))}
        </g>
      ))}

      {BEACONS.map(({ x, width, height, crown }) => {
        const centre = x + width / 2;
        const roof = VIEW_HEIGHT - height - (crown ? 22 : 0);
        return (
          <g key={x}>
            <rect x={centre - 1} y={roof - 34} width={2} height={34} fill={FRONT_LAYER.body} />
            <circle cx={centre} cy={roof - 36} r={3} fill="#fc5f07" className="skyline-beacon" />
          </g>
        );
      })}
    </svg>
  );
}
