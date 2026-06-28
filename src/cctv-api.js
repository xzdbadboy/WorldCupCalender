/**
 * CCTV 体育 API 集成
 *
 * 用于获取世界杯比赛数据（按时间动态查询）
 * API 来源: https://cbs-i.sports.cctv.com/cache/
 * 作为备用数据源，当其他 API 失败时使用
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import moment from 'moment-timezone';

const CACHE_DIR = path.join(process.cwd(), 'cache');
const CCTV_CACHE_FILE = path.join(CACHE_DIR, 'cctv-api-cache.json');
const CACHE_DURATION_HOURS = process.env.CACHE_DURATION_HOURS || 24;

// CCTV API 配置
const CCTV_API_BASE = 'https://cbs-i.sports.cctv.com';
const CACHE_KEY = 'f26a37123b56df9205cf3948f7a3e316'; // 世界杯赛程缓存 key

/**
 * 确保缓存目录存在
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * 检查缓存是否有效
 */
function isCacheValid() {
  if (!fs.existsSync(CCTV_CACHE_FILE)) {
    return false;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(CCTV_CACHE_FILE, 'utf-8'));
    const cacheAge = Date.now() - new Date(cache.timestamp).getTime();
    const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;

    return cacheAge < maxAge;
  } catch (error) {
    console.error('读取 CCTV 缓存失败:', error.message);
    return false;
  }
}

/**
 * 从缓存读取数据
 */
function readCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(CCTV_CACHE_FILE, 'utf-8'));
    return cache.data;
  } catch (error) {
    console.error('读取 CCTV 缓存失败:', error.message);
    return null;
  }
}

/**
 * 写入缓存
 */
function writeCache(data) {
  ensureCacheDir();
  const cache = {
    timestamp: new Date().toISOString(),
    data: data
  };
  fs.writeFileSync(CCTV_CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * 从 CCTV API 获取比赛数据
 */
async function fetchCCTVMatches() {
  const url = `${CCTV_API_BASE}/cache/${CACHE_KEY}`;

  // 使用当前时间戳作为参数（CCTV 要求）
  const timestamp = Date.now();

  try {
    console.log('正在从 CCTV 体育 API 获取数据...');
    const response = await axios.get(url, {
      params: {
        ran: timestamp
      },
      headers: {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Origin': 'https://cbs.sports.cctv.com',
        'Referer': 'https://cbs.sports.cctv.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.success && response.data.results) {
      console.log(`✅ 成功获取 ${response.data.results.length} 场比赛数据`);
      return response.data.results;
    } else {
      throw new Error('API 返回数据格式不正确');
    }
  } catch (error) {
    console.error('❌ CCTV 体育 API 调用失败:', error.message);
    throw error;
  }
}

/**
 * 获取比赛数据（带缓存）
 */
async function getCCTVMatches() {
  // 检查缓存
  if (isCacheValid()) {
    console.log('✅ 使用 CCTV 体育 API 缓存数据');
    return readCache();
  }

  // 从 API 获取
  const matches = await fetchCCTVMatches();

  // 写入缓存
  writeCache(matches);

  return matches;
}

/**
 * 映射 CCTV 的比赛状态
 */
function mapStatus(gameStatus) {
  // gameStatus: 0=未开始, 1=进行中, 2=中场, 3=已结束
  const statusMap = {
    0: 'SCHEDULED',
    1: 'IN_PLAY',
    2: 'IN_PLAY',
    3: 'FINISHED'
  };

  return statusMap[gameStatus] || 'SCHEDULED';
}

/**
 * 映射 CCTV 的赛程阶段
 */
function mapGameRound(gameRound, roundType) {
  // gameRound: 第1轮、第2轮、第3轮、1/16决赛等
  // roundType: A组、B组等

  if (gameRound.includes('1/16')) {
    return 'LAST_16';
  } else if (gameRound.includes('1/8')) {
    return 'QUARTER_FINALS';
  } else if (gameRound.includes('1/4')) {
    return 'SEMI_FINALS';
  } else if (gameRound.includes('半决赛')) {
    return 'SEMI_FINALS';
  } else if (gameRound.includes('决赛') && !gameRound.includes('半')) {
    return 'FINAL';
  } else if (gameRound.includes('三四名')) {
    return 'THIRD_PLACE';
  } else {
    return 'GROUP_STAGE';
  }
}

/**
 * 将 CCTV API 数据转换为统一格式
 */
function normalizeCCTVMatch(cctvMatch) {
  // CCTV 时间格式: "2026-06-12 03:00:00"，需要转换为 UTC
  const beijingTime = moment.tz(cctvMatch.startTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
  const utcTime = beijingTime.utc().format('YYYY-MM-DDTHH:mm:ss') + 'Z';

  return {
    id: cctvMatch.id.toString(),
    utcDate: utcTime,
    status: mapStatus(cctvMatch.gameStatus),
    stage: mapGameRound(cctvMatch.gameRound, cctvMatch.roundType),
    group: cctvMatch.roundType || null,
    homeTeam: {
      id: cctvMatch.homeId.toString(),
      name: cctvMatch.homeName,
      shortName: cctvMatch.homeName,
      crest: cctvMatch.homePicUrl,
      tla: null
    },
    awayTeam: {
      id: cctvMatch.guestId.toString(),
      name: cctvMatch.guestName,
      shortName: cctvMatch.guestName,
      crest: cctvMatch.guestPicUrl,
      tla: null
    },
    score: {
      fullTime: {
        home: cctvMatch.homeFullScore,
        away: cctvMatch.guestFullScore
      },
      halfTime: {
        home: cctvMatch.homeHalfScore,
        away: cctvMatch.guestHalfScore
      }
    },
    stadium: {
      name: cctvMatch.gamePlace,
      city: null
    },
    // CCTV 特有的额外信息
    extra: {
      liveChannel: cctvMatch.liveChannel,
      commentator: cctvMatch.commentator,
      referee: cctvMatch.referee
    },
    source: 'cctv' // 标记数据来源
  };
}

/**
 * 获取所有比赛
 */
async function getAllMatches() {
  const allMatches = await getCCTVMatches();

  console.log(`📊 CCTV 体育共 ${allMatches.length} 场比赛`);

  // 转换为统一格式
  return allMatches.map(normalizeCCTVMatch);
}

export {
  getCCTVMatches,
  getAllMatches,
  normalizeCCTVMatch
};
