/**
 * FIFA 官方 API 集成
 *
 * 用于获取世界杯淘汰赛阶段的比赛数据
 * API 来源: https://api.fifa.com/api/v3/calendar/matches
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), 'cache');
const FIFA_CACHE_FILE = path.join(CACHE_DIR, 'fifa-api-cache.json');
const CACHE_DURATION_HOURS = process.env.CACHE_DURATION_HOURS || 24;

// FIFA API 配置
const FIFA_API_BASE = 'https://api.fifa.com/api/v3';
const COMPETITION_ID = '17'; // FIFA World Cup
const SEASON_ID = '285023'; // 2026 赛季

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
  if (!fs.existsSync(FIFA_CACHE_FILE)) {
    return false;
  }

  try {
    const cache = JSON.parse(fs.readFileSync(FIFA_CACHE_FILE, 'utf-8'));
    const cacheAge = Date.now() - new Date(cache.timestamp).getTime();
    const maxAge = CACHE_DURATION_HOURS * 60 * 60 * 1000;

    return cacheAge < maxAge;
  } catch (error) {
    console.error('读取 FIFA 缓存失败:', error.message);
    return false;
  }
}

/**
 * 从缓存读取数据
 */
function readCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(FIFA_CACHE_FILE, 'utf-8'));
    return cache.data;
  } catch (error) {
    console.error('读取 FIFA 缓存失败:', error.message);
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
  fs.writeFileSync(FIFA_CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * 从 FIFA API 获取比赛数据
 */
async function fetchFIFAMatches() {
  const url = `${FIFA_API_BASE}/calendar/matches`;
  const params = {
    language: 'en',
    idCompetition: COMPETITION_ID,
    idSeason: SEASON_ID,
    count: 400
  };

  try {
    console.log('正在从 FIFA 官方 API 获取数据...');
    const response = await axios.get(url, {
      params,
      headers: {
        'Accept': 'application/json',
        'Origin': 'https://www.fifa.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (response.data && response.data.Results) {
      console.log(`✅ 成功获取 ${response.data.Results.length} 场比赛数据`);
      return response.data.Results;
    } else {
      throw new Error('API 返回数据格式不正确');
    }
  } catch (error) {
    console.error('❌ FIFA API 调用失败:', error.message);
    throw error;
  }
}

/**
 * 获取比赛数据（带缓存）
 */
async function getFIFAMatches() {
  // 检查缓存
  if (isCacheValid()) {
    console.log('✅ 使用 FIFA API 缓存数据');
    return readCache();
  }

  // 从 API 获取
  const matches = await fetchFIFAMatches();

  // 写入缓存
  writeCache(matches);

  return matches;
}

/**
 * 将 FIFA API 数据转换为统一格式
 */
function normalizeFIFAMatch(fifaMatch) {
  return {
    id: fifaMatch.IdMatch,
    utcDate: fifaMatch.Date,
    status: fifaMatch.MatchStatus || 'SCHEDULED',
    stage: mapStage(fifaMatch.StageName?.[0]?.Description),
    group: fifaMatch.GroupName?.[0]?.Description || null,
    homeTeam: {
      id: fifaMatch.Home?.IdTeam,
      name: fifaMatch.Home?.TeamName?.[0]?.Description || '待定',
      shortName: fifaMatch.Home?.ShortClubName || '待定',
      crest: fifaMatch.Home?.PictureUrl,
      tla: fifaMatch.Home?.Abbreviation
    },
    awayTeam: {
      id: fifaMatch.Away?.IdTeam,
      name: fifaMatch.Away?.TeamName?.[0]?.Description || '待定',
      shortName: fifaMatch.Away?.ShortClubName || '待定',
      crest: fifaMatch.Away?.PictureUrl,
      tla: fifaMatch.Away?.Abbreviation
    },
    score: {
      fullTime: {
        home: fifaMatch.HomeTeamScore,
        away: fifaMatch.AwayTeamScore
      },
      halfTime: {
        home: null,
        away: null
      }
    },
    stadium: {
      name: fifaMatch.Stadium?.Name?.[0]?.Description,
      city: fifaMatch.Stadium?.CityName?.[0]?.Description
    }
  };
}

/**
 * 映射赛程阶段名称
 */
function mapStage(stageName) {
  const stageMap = {
    'First Stage': 'GROUP_STAGE',
    'Round of 32': 'LAST_32',
    'Round of 16': 'LAST_16',
    'Quarter-final': 'QUARTER_FINALS',
    'Semi-final': 'SEMI_FINALS',
    'Play-off for third place': 'THIRD_PLACE',
    'Final': 'FINAL'
  };

  return stageMap[stageName] || stageName;
}

/**
 * 按阶段筛选比赛
 */
function filterByStage(matches, stage) {
  return matches.filter(match => {
    const matchStage = match.StageName?.[0]?.Description;
    return matchStage === stage;
  });
}

/**
 * 获取淘汰赛阶段的比赛
 */
async function getKnockoutMatches() {
  const allMatches = await getFIFAMatches();

  const knockoutStages = [
    'Round of 32',
    'Round of 16',
    'Quarter-final',
    'Semi-final',
    'Play-off for third place',
    'Final'
  ];

  const knockoutMatches = allMatches.filter(match => {
    const stageName = match.StageName?.[0]?.Description;
    return knockoutStages.includes(stageName);
  });

  console.log(`📊 淘汰赛阶段共 ${knockoutMatches.length} 场比赛`);

  // 转换为统一格式
  return knockoutMatches.map(normalizeFIFAMatch);
}

export {
  getFIFAMatches,
  getKnockoutMatches,
  normalizeFIFAMatch
};
