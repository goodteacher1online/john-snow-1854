export interface StreetSegment {
  name: string;
  points: [number, number][]; // [x, y] 상대좌표 (0 ~ 2200)
  width?: number; // 도로 유효 보행 폭
  isMain?: boolean;
}

export const SOHO_STREETS: StreetSegment[] = [
  // 1. Oxford Street (북측 최상단 대로)
  {
    name: "Oxford Street",
    points: [[150, 340], [600, 340], [1100, 350], [1600, 360], [2050, 370]],
    width: 65,
    isMain: true
  },
  // 2. Great Marlborough Street (북측 가로 간선)
  {
    name: "Great Marlborough Street",
    points: [[550, 600], [800, 610], [1050, 610], [1400, 620], [1800, 640]],
    width: 58,
    isMain: true
  },
  // 3. Broad Street (중심 가로 도로 - 펌프 및 환자 밀집 구역)
  {
    name: "Broad Street",
    points: [[300, 1060], [650, 1070], [950, 1090], [1100, 1100], [1300, 1110], [1600, 1130], [1950, 1150]],
    width: 60,
    isMain: true
  },
  // 4. Silver Street / Beak Street (남측 가로 도로)
  {
    name: "Silver Street",
    points: [[350, 1580], [700, 1600], [1050, 1620], [1350, 1640], [1750, 1660]],
    width: 54,
    isMain: true
  },
  // 5. Brewer Street (최남단 가로 도로)
  {
    name: "Brewer Street",
    points: [[350, 1850], [750, 1860], [1150, 1870], [1550, 1880], [1950, 1890]],
    width: 56,
    isMain: true
  },
  // 6. Regent Street (서측 종단 대로)
  {
    name: "Regent Street",
    points: [[380, 340], [420, 650], [460, 1050], [480, 1450], [520, 1850]],
    width: 65,
    isMain: true
  },
  // 7. Poland Street (북측 구빈원 연결 세로 도로)
  {
    name: "Poland Street",
    points: [[680, 340], [700, 600], [730, 850], [750, 1070]],
    width: 52,
    isMain: true
  },
  // 8. Cambridge Street / Little Windmill (중앙 남북 관통 도로)
  {
    name: "Cambridge Street",
    points: [[1100, 350], [1100, 610], [1100, 850], [1100, 1100], [1120, 1350], [1140, 1630], [1160, 1870]],
    width: 56,
    isMain: true
  },
  // 9. Marshall Street (중서부 남북 골목)
  {
    name: "Marshall Street",
    points: [[840, 1080], [850, 1350], [870, 1610], [880, 1860]],
    width: 48
  },
  // 10. Dean Street (서부 세로 도로)
  {
    name: "Dean Street",
    points: [[660, 1070], [670, 1300], [680, 1600], [700, 1860]],
    width: 52
  },
  // 11. Warwick Street (동부 세로 도로)
  {
    name: "Warwick Street",
    points: [[1380, 620], [1400, 950], [1420, 1250], [1440, 1640]],
    width: 52
  },
  // 12. Berwick Street (동측 가로지르는 긴 번화가)
  {
    name: "Berwick Street",
    points: [[1750, 360], [1770, 750], [1790, 1150], [1820, 1550], [1850, 1890]],
    width: 56,
    isMain: true
  },
  // 13. King Street / Golden Square 순환로
  {
    name: "King Street",
    points: [[460, 1050], [480, 1300], [500, 1580]],
    width: 48
  },
  // 14. 골든 스퀘어 광장 순환로 (Golden Square Perimeter)
  {
    name: "Golden Square Way",
    points: [[750, 1420], [920, 1420], [920, 1580], [750, 1580], [750, 1420]],
    width: 58
  },
  // 15. 크로스 스트리트 (Cross Street)
  {
    name: "Cross Street",
    points: [[740, 850], [950, 860], [1100, 860], [1400, 870], [1770, 880]],
    width: 50
  },
  // 16. 햄스테드 마차 연락로 (북서 외곽)
  {
    name: "Hampstead Coach Road",
    points: [[260, 310], [300, 330], [380, 340]],
    width: 52
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
