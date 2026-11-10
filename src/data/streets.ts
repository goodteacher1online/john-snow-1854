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
    points: [[100, 340], [500, 340], [900, 350], [1300, 350], [1700, 360], [2100, 370]],
    width: 120,
    isMain: true
  },
  // 2. Great Marlborough Street (북측 가로 간선)
  {
    name: "Great Marlborough Street",
    points: [[450, 600], [750, 605], [1030, 610], [1350, 620], [1750, 630], [2050, 640]],
    width: 110,
    isMain: true
  },
  // 3. Broad Street (중심 가로 대로 - 펌프 및 환자 밀집 구역)
  {
    name: "Broad Street",
    points: [[250, 1060], [600, 1070], [850, 1085], [1050, 1095], [1150, 1105], [1350, 1120], [1650, 1135], [2000, 1150]],
    width: 115,
    isMain: true
  },
  // 4. Silver Street / Beak Street (남측 가로 도로)
  {
    name: "Silver Street",
    points: [[300, 1580], [650, 1600], [950, 1615], [1250, 1630], [1550, 1645], [1900, 1660]],
    width: 105,
    isMain: true
  },
  // 5. Brewer Street (최남단 가로 대로)
  {
    name: "Brewer Street",
    points: [[300, 1850], [700, 1860], [1100, 1870], [1500, 1880], [1950, 1890]],
    width: 110,
    isMain: true
  },
  // 6. Regent Street (서측 종단 대로)
  {
    name: "Regent Street",
    points: [[360, 340], [400, 650], [440, 1050], [470, 1450], [510, 1850]],
    width: 120,
    isMain: true
  },
  // 7. Poland Street (북측 구빈원 연결 세로 도로)
  {
    name: "Poland Street",
    points: [[660, 340], [680, 580], [710, 850], [730, 1070], [740, 1200]],
    width: 100,
    isMain: true
  },
  // 8. Cambridge Street / Little Windmill (중앙 남북 관통 도로)
  {
    name: "Cambridge Street",
    points: [[1090, 350], [1090, 610], [1100, 850], [1100, 1100], [1115, 1350], [1135, 1630], [1155, 1870]],
    width: 105,
    isMain: true
  },
  // 9. Marshall Street (중서부 남북 골목)
  {
    name: "Marshall Street",
    points: [[830, 850], [840, 1080], [850, 1350], [865, 1610], [875, 1860]],
    width: 95
  },
  // 10. Dean Street (서부 세로 도로)
  {
    name: "Dean Street",
    points: [[650, 1070], [660, 1300], [670, 1600], [690, 1860]],
    width: 100
  },
  // 11. Warwick Street (동부 세로 도로)
  {
    name: "Warwick Street",
    points: [[1370, 620], [1390, 950], [1410, 1250], [1430, 1640], [1440, 1880]],
    width: 100
  },
  // 12. Berwick Street (동측 가로지르는 긴 번화가)
  {
    name: "Berwick Street",
    points: [[1730, 360], [1750, 750], [1775, 1150], [1805, 1550], [1835, 1890]],
    width: 105,
    isMain: true
  },
  // 13. King Street / Golden Square 연결로
  {
    name: "King Street",
    points: [[450, 1050], [470, 1300], [490, 1580]],
    width: 95
  },
  // 14. 골든 스퀘어 광장 순환로 (Golden Square Perimeter)
  {
    name: "Golden Square Way",
    points: [[720, 1400], [940, 1400], [940, 1600], [720, 1600], [720, 1400]],
    width: 110
  },
  // 15. 크로스 스트리트 (Cross Street)
  {
    name: "Cross Street",
    points: [[720, 850], [940, 855], [1100, 860], [1380, 865], [1750, 875]],
    width: 95
  },
  // 16. 카나비 스트리트 (Carnaby Street)
  {
    name: "Carnaby Street",
    points: [[770, 605], [785, 780], [800, 950], [810, 1080]],
    width: 90
  },
  // 17. 리틀 말버러 가 (Little Marlborough Street)
  {
    name: "Little Marlborough Street",
    points: [[680, 720], [750, 720], [850, 720], [1030, 720]],
    width: 95
  },
  // 18. 브라이들 골목 (Bridle Lane)
  {
    name: "Bridle Lane",
    points: [[1270, 1120], [1280, 1350], [1285, 1500], [1290, 1640]],
    width: 90
  },
  // 19. 루퍼트 가 (Rupert Street)
  {
    name: "Rupert Street",
    points: [[1390, 1400], [1410, 1650], [1425, 1880]],
    width: 95
  },
  // 20. 티치본 가 (Tichborne Street)
  {
    name: "Tichborne Street",
    points: [[840, 1750], [920, 1800], [1050, 1820], [1150, 1830]],
    width: 95
  },
  // 21. 드루어리 골목 및 듀포어 플레이스 (Dufour's Place)
  {
    name: "Dufour's Place",
    points: [[1150, 1030], [1230, 1030], [1230, 1140]],
    width: 85
  },
  // 22. 에드워드 가 (Edward Street)
  {
    name: "Edward Street",
    points: [[1350, 1120], [1500, 1125], [1750, 1135]],
    width: 90
  },
  // 23. 세인트 제임스 묘지 골목
  {
    name: "Churchyard Walk",
    points: [[740, 1000], [840, 1010], [950, 1020]],
    width: 85
  },
  // 24. 햄스테드 마차 연락로 (북서 외곽)
  {
    name: "Hampstead Coach Road",
    points: [[250, 310], [290, 330], [360, 340]],
    width: 95
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
