/**
 * 懂球帝 API 集成
 *
 * 用于获取世界杯淘汰赛阶段的比赛数据（中文原生）
 * API 来源: https://api.dongqiudi.com/data/tab/league/new/61
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'cache');
const DQD_CACHE_FILE = path.join(CACHE_DIR, 'dongqiudi-api-cache.json');
const CACHE_DURATION_HOURS = process.env.CACHE_DURATION_HOURS || 24;

// 懂球帝 API 配置
const DQD_API_BASE = 'https://api.dongqiudi.com';
const LEAGUE_ID = '61'; // 世界杯

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
  if (!fs.existsSync(DQD_CACHE_FILE)) {
    return false;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(DQD_CACHE_FILE, 'utf-8'));
    const cacheAge = Date.now() - new Date(cache.timestamp).getTime();
    const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;

    return cacheAge < maxAge;
  } catch (error) {
    console.error('读取懂球帝缓存失败:', error.message);
    return false;
  }
}

/**
 * 从缓存读取数据
 */
function readCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(DQD_CACHE_FILE, 'utf-8'));
    return cache.data;
  } catch (error) {
    console.error('读取懂球帝缓存失败:', error.message);
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
  fs.writeFileSync(DQD_CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * 从懂球帝 API 获取比赛数据
 */
async function fetchDongqiudiMatches() {
  const url = `${DQD_API_BASE}/data/tab/league/new/${LEAGUE_ID}`;

  // 使用当前日期作为起始点
  const today = new Date();
  const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000); // 往前推7天
  const startDateStr = startDate.toISOString().split('T')[0];

  const params = {
    start: startDateStr,
    version: 576,
    init: 1,
    wfrom: 2,
    from: 'msite_com'
  };

  try {
    console.log('正在从懂球帝 API 获取数据...');
    const response = await axios.get(url, {
      params,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Origin': 'https://m.dongqiudi.com',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.list) {
      console.log(`✅ 成功获取 ${response.data.list.length} 场比赛数据`);
      return response.data.list;
    } else {
      throw new Error('API 返回数据格式不正确');
    }
  } catch (error) {
    console.error('❌ 懂球帝 API 调用失败:', error.message);
    throw error;
  }
}

/**
 * 获取比赛数据（带缓存）
 */
async function getDongqiudiMatches() {
  // 检查缓存
  if (isCacheValid()) {
    console.log('✅ 使用懂球帝 API 缓存数据');
    return readCache();
  }

  // 从 API 获取
  const matches = await fetchDongqiudiMatches();

  // 写入缓存
  writeCache(matches);

  return matches;
}

/**
 * 映射懂球帝的赛程阶段名称到标准格式
 */
function mapRoundName(roundName) {
  const roundMap = {
    '小组赛': 'GROUP_STAGE',
    '1/16决赛': 'LAST_16',          // 16强赛
    '1/8决赛': 'QUARTER_FINALS',    // 8强赛（1/4决赛）
    '1/4决赛': 'SEMI_FINALS',       // 半决赛（4强赛）
    '半决赛': 'SEMI_FINALS',        // 半决赛（注意：懂球帝可能用这个表示决赛前的半决赛）
    '决赛': 'FINAL',                // 决赛
    '三四名决赛': 'THIRD_PLACE'     // 三四名决赛
  };

  return roundMap[roundName] || roundName;
}

/**
 * 映射懂球帝的比赛状态
 */
function mapStatus(status) {
  const statusMap = {
    'Fixture': 'SCHEDULED',
    'Playing': 'IN_PLAY',
    'Played': 'FINISHED'
  };

  return statusMap[status] || status;
}

/**
 * 将懂球帝 API 数据转换为统一格式
 */
function normalizeDongqiudiMatch(dqdMatch) {
  return {
    id: dqdMatch.match_id,
    utcDate: `${dqdMatch.date_utc}T${dqdMatch.time_utc}Z`,
    status: mapStatus(dqdMatch.status),
    stage: mapRoundName(dqdMatch.round_name),
    group: null,
    homeTeam: {
      id: dqdMatch.team_A_id,
      name: dqdMatch.team_A_name,
      shortName: dqdMatch.team_A_name,
      crest: dqdMatch.team_A_logo,
      tla: null
    },
    awayTeam: {
      id: dqdMatch.team_B_id,
      name: dqdMatch.team_B_name,
      shortName: dqdMatch.team_B_name,
      crest: dqdMatch.team_B_logo,
      tla: null
    },
    score: {
      fullTime: {
        home: dqdMatch.fs_A ? parseInt(dqdMatch.fs_A) : null,
        away: dqdMatch.fs_B ? parseInt(dqdMatch.fs_B) : null
      },
      halfTime: {
        home: dqdMatch.hts_A ? parseInt(dqdMatch.hts_A) : null,
        away: dqdMatch.hts_B ? parseInt(dqdMatch.hts_B) : null
      }
    },
    source: 'dongqiudi' // 标记数据来源
  };
}

/**
 * 获取淘汰赛阶段的比赛
 */
async function getKnockoutMatches() {
  const allMatches = await getDongqiudiMatches();

  const knockoutRounds = ['1/16决赛', '1/8决赛', '1/4决赛', '半决赛', '决赛', '三四名决赛'];

  const knockoutMatches = allMatches.filter(match => {
    return knockoutRounds.includes(match.round_name);
  });

  console.log(`📊 懂球帝淘汰赛阶段共 ${knockoutMatches.length} 场比赛`);

  // 转换为统一格式
  return knockoutMatches.map(normalizeDongqiudiMatch);
}

/**
 * 获取所有比赛（小组赛 + 淘汰赛）
 */
async function getAllMatches() {
  const allMatches = await getDongqiudiMatches();

  console.log(`📊 懂球帝共 ${allMatches.length} 场比赛`);

  // 转换为统一格式
  return allMatches.map(normalizeDongqiudiMatch);
}

export {
  getDongqiudiMatches,
  getKnockoutMatches,
  getAllMatches,
  normalizeDongqiudiMatch
};
