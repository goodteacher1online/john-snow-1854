export interface StreetSegment {
  name: string;
  points: [number, number][]; // [x, y] 상대좌표 (0 ~ 1000)
  isMain?: boolean;
}

export const SOHO_STREETS: StreetSegment[] = [
  // Broad Street (중심 가로 도로 - 펌프 위치)
  {
    name: "Broad Street",
    points: [[150, 480], [350, 490], [500, 500], [680, 510], [850, 520]],
    isMain: true
  },
  // Cambridge Street (남북 관통 도로)
  {
    name: "Cambridge Street",
    points: [[500, 200], [500, 350], [500, 500], [510, 650], [520, 800]],
    isMain: true
  },
  // Poland Street (북측 구빈원 거리)
  {
    name: "Poland Street",
    points: [[320, 150], [330, 300], [340, 485]],
    isMain: true
  },
  // Great Pulteney Street (서남측 도로)
  {
    name: "Great Pulteney Street",
    points: [[220, 500], [230, 680], [240, 850]],
    isMain: true
  },
  // Silver Street (남측 가로 도로)
  {
    name: "Silver Street",
    points: [[180, 720], [360, 730], [520, 740], [700, 750]],
    isMain: true
  },
  // Little Windmill Street (동남측 도로)
  {
    name: "Little Windmill Street",
    points: [[680, 510], [690, 680], [700, 850]],
    isMain: true
  },
  // Marshall Street
  {
    name: "Marshall Street",
    points: [[380, 490], [390, 650], [400, 780]]
  },
  // Berwick Street (동측 가로지르는 긴 도로)
  {
    name: "Berwick Street",
    points: [[780, 180], [800, 400], [820, 650], [840, 850]],
    isMain: true
  },
  // Cross Street (소호 광장 방향 연결)
  {
    name: "Cross Street",
    points: [[340, 320], [500, 330], [660, 340], [790, 350]]
  }
];

// 건물 블록 및 주요 광장
export interface CityBlock {
  id: string;
  polygon: [number, number][];
  label?: string;
  isSpecial?: boolean;
}

export const SOHO_BLOCKS: CityBlock[] = [
  // 양조장 구역 (Huggin's Brewery)
  {
    id: "brewery_block",
    polygon: [[420, 520], [480, 520], [480, 580], [420, 580]],
    label: "HUGGINS BREWERY (양조장)",
    isSpecial: true
  },
  // 구빈원 구역 (Workhouse)
  {
    id: "workhouse_block",
    polygon: [[240, 220], [320, 220], [320, 320], [240, 320]],
    label: "ST. JAMES WORKHOUSE (구빈원)",
    isSpecial: true
  },
  // 골든 스퀘어 (남서 광장)
  {
    id: "golden_square",
    polygon: [[100, 650], [180, 650], [180, 750], [100, 750]],
    label: "GOLDEN SQUARE (골든 스퀘어)"
  }
];
