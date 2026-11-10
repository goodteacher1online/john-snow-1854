export interface StreetSegment {
  name: string;
  points: [number, number][]; // [x, y] 상대좌표 (0 ~ 2200)
  isMain?: boolean;
}

export const SOHO_STREETS: StreetSegment[] = [
  // Broad Street (중심 가로 도로 - 펌프 위치)
  {
    name: "Broad Street",
    points: [[330, 1060], [770, 1080], [1100, 1100], [1500, 1120], [1870, 1140]],
    isMain: true
  },
  // Cambridge Street (남북 관통 도로)
  {
    name: "Cambridge Street",
    points: [[1100, 440], [1100, 770], [1100, 1100], [1120, 1430], [1140, 1760]],
    isMain: true
  },
  // Poland Street (북측 구빈원 거리)
  {
    name: "Poland Street",
    points: [[700, 330], [730, 660], [750, 1070]],
    isMain: true
  },
  // Great Pulteney Street (서남측 도로)
  {
    name: "Great Pulteney Street",
    points: [[480, 1100], [510, 1500], [530, 1870]],
    isMain: true
  },
  // Silver Street (남측 가로 도로)
  {
    name: "Silver Street",
    points: [[400, 1580], [790, 1610], [1140, 1630], [1540, 1650]],
    isMain: true
  },
  // Little Windmill Street (동남측 도로)
  {
    name: "Little Windmill Street",
    points: [[1500, 1120], [1520, 1500], [1540, 1870]],
    isMain: true
  },
  // Marshall Street
  {
    name: "Marshall Street",
    points: [[840, 1080], [860, 1430], [880, 1720]]
  },
  // Berwick Street (동측 가로지르는 긴 도로)
  {
    name: "Berwick Street",
    points: [[1720, 400], [1760, 880], [1800, 1430], [1850, 1870]],
    isMain: true
  },
  // Cross Street (소호 광장 방향 연결)
  {
    name: "Cross Street",
    points: [[750, 700], [1100, 730], [1450, 750], [1740, 770]]
  }
];

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
    polygon: [[920, 1140], [1060, 1140], [1060, 1280], [920, 1280]],
    label: "HUGGINS BREWERY (양조장)",
    isSpecial: true
  },
  // 구빈원 구역 (Workhouse)
  {
    id: "workhouse_block",
    polygon: [[530, 480], [700, 480], [700, 700], [530, 700]],
    label: "ST. JAMES WORKHOUSE (구빈원)",
    isSpecial: true
  },
  // 골든 스퀘어 (남서 광장)
  {
    id: "golden_square",
    polygon: [[220, 1430], [400, 1430], [400, 1650], [220, 1650]],
    label: "GOLDEN SQUARE (골든 스퀘어)"
  }
];
