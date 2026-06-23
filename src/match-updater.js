import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import { fetchWorldCupMatches } from './api.js';
import { generateAndSaveICal } from './ical-generator.js';
import { getStateTracker, updateStateTracker } from './state-tracker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, '..', '.state', 'tracker.json');

async function ensureStateDirectory() {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 获取今天的所有比赛（北京时间判断）
 * 返回北京时间在今天的所有比赛
 */
function getTodayMatches(allMatches) {
  const now = moment().tz('Asia/Shanghai');
  const todayStart = now.clone().startOf('day');
  const todayEnd = now.clone().endOf('day');

  return allMatches.filter(match => {
    const matchTime = moment(match.utcDate).tz('Asia/Shanghai');
    return matchTime.isBetween(todayStart, todayEnd, null, '[]');
  });
}

/**
 * 检查比赛是否已获取比分
 */
function isMatchFinished(match) {
  return match.status === 'FINISHED' && match.score?.fullTime?.home !== null;
}

/**
 * 主处理逻辑
 */
export async function checkAndUpdateMatches() {
  try {
    console.log(`\n[${new Date().toISOString()}] 开始检查比赛数据...`);

    await ensureStateDirectory();

    // 获取比赛数据
    const season = 2026;
    const apiData = await fetchWorldCupMatches(season);
    const todayMatches = getTodayMatches(apiData.matches);

    console.log(`今天找到 ${todayMatches.length} 场比赛`);

    if (todayMatches.length === 0) {
      console.log('今天没有比赛，任务结束');
      return {};
    }

    const state = await getStateTracker();

    // 处理已完成的比赛
    for (const match of todayMatches) {
      const matchId = match.id;
      const isProcessed = state.processedMatches?.[matchId];

      if (isMatchFinished(match)) {
        if (!isProcessed) {
          console.log(`处理已完成比赛: ${match.homeTeam.name} vs ${match.awayTeam.name}`);

          // 更新 iCal 文件
          generateAndSaveICal(apiData.matches, 2026, 'WorldCupSchedule.ics');
          console.log('✓ ICS 文件已更新');

          // 更新状态
          await updateStateTracker(matchId, {
            status: 'FINISHED',
            enrichedAt: new Date().toISOString()
          });

          console.log(`✓ 比赛已处理: ${match.homeTeam.name} ${match.score.fullTime.home}-${match.score.fullTime.away} ${match.awayTeam.name}`);
        }
      }
    }

    // 无需计算下次检查时间（固定 20 分钟检查）
    return {};

  } catch (error) {
    console.error('比赛检查失败:', error.message);
    throw error;
  }
}


/**
 * 检查是否有比赛应该已结束但还无比分
 */
function hasMatchWithoutScoreAfterDeadline(allMatches) {
  const now = moment().utc();
  return allMatches.some(m => {
    if (m.status === 'FINISHED' && isMatchFinished(m)) {
      return false;
    }
    const estimatedEndTime = moment(m.utcDate).add(105, 'minutes');
    return now.isAfter(estimatedEndTime) && m.status !== 'FINISHED';
  });
}

/**
 * 以 5 分钟间隔重复检查，直到获取到比分
 */
export async function checkWithRetry() {
  let retryCount = 0;
  const maxRetries = 18; // 90分钟（5分钟/次）

  while (retryCount < maxRetries) {
    try {
      const result = await checkAndUpdateMatches();

      // 检查是否有比赛应该已结束但还没有比分
      const apiData = await fetchWorldCupMatches(2026);
      if (hasMatchWithoutScoreAfterDeadline(apiData.matches)) {
        retryCount++;
        const nextRetry = moment().utc().add(5, 'minutes');
        const taipei = nextRetry.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');

        console.log(`\n⏳ 检测到比赛可能还在进行中（加时赛中）`);
        console.log(`📍 将在 5 分钟后重试检查（第 ${retryCount} 次）`);
        console.log(`下次重试时间（北京时间）: ${taipei}`);

        // 等待 5 分钟再次检查
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        continue;
      }

      if (result.nextCheckTime) {
        const taipei = moment(result.nextCheckTime).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
        console.log(`\n下一次检查时间（北京时间）: ${taipei}`);
        return result.nextCheckTime;
      }

      return null;

    } catch (error) {
      console.error('检查失败:', error.message);
      retryCount++;
      if (retryCount < maxRetries) {
        const nextRetry = moment().utc().add(5, 'minutes');
        const taipei = nextRetry.tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
        console.log(`5 分钟后重试...（第 ${retryCount} 次）`);
        console.log(`下次重试时间（北京时间）: ${taipei}`);

        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        continue;
      } else {
        console.error('超出最大重试次数（90分钟），放弃');
        throw error;
      }
    }
  }

  throw new Error('比赛加时检查超时（90分钟）');
}
