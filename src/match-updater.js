import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import { fetchWorldCupMatches } from './api.js';
import { enrichMatchWithDetails } from './enrich-match.js';
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
 * 找到下一场未完成的比赛
 */
function getNextUnfinishedMatch(allMatches) {
  const now = moment().utc();
  return allMatches
    .filter(m => m.status !== 'FINISHED')
    .sort((a, b) => moment(a.utcDate).utc() - moment(b.utcDate).utc())
    .find(m => moment(m.utcDate).utc().isAfter(now) ||
               moment(m.utcDate).utc().isSame(now) ||
               moment(m.utcDate).utc().add(2.5, 'hours').isAfter(now));
}

/**
 * 计算比赛的估计结束时间（考虑加时）
 * 基础：90分钟 + 15分钟缓冲（应对伤停补时、加时、点球等）
 */
function calculateMatchEndTime(match) {
  return moment(match.utcDate).add(105, 'minutes');
}

/**
 * 计算下次检查时间（智能调度）
 */
function calculateNextCheckTime(allMatches) {
  const now = moment().utc();
  const nextMatch = getNextUnfinishedMatch(allMatches);

  if (!nextMatch) {
    return null;
  }

  const nextMatchEndTime = calculateMatchEndTime(nextMatch);
  const intervalToMatchEnd = nextMatchEndTime.diff(now, 'hours', true);

  // 如果间隔 > 2小时，设定为该比赛结束时间
  if (intervalToMatchEnd > 2) {
    return nextMatchEndTime;
  }

  // 间隔 ≤ 2小时，需要进入 5 分钟检查循环
  // 或者立即检查（如果比赛已经开始/即将开始）
  if (intervalToMatchEnd > 0) {
    return nextMatchEndTime.clone().add(5, 'minutes');
  }

  // 如果已经过了估计的结束时间但没获取到比分
  // 进入 5 分钟小循环
  return now.clone().add(5, 'minutes');
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
      return { nextCheckTime: null };
    }

    const state = await getStateTracker();
    let nextCheckTime = null;

    // 调试：统计小组赛数据
    const groupMatches = apiData.matches.filter(m => m.stage === 'GROUP_STAGE');
    const finishedGroupMatches = groupMatches.filter(m => m.status === 'FINISHED');
    console.log(`[调试] 小组赛总数: ${groupMatches.length}, 已完成: ${finishedGroupMatches.length}`);

    for (const match of todayMatches) {
      const matchId = match.id;
      const isProcessed = state.processedMatches?.[matchId];

      if (isMatchFinished(match)) {
        // 已结束的比赛
        if (!isProcessed) {
          console.log(`处理已结束比赛: ${match.homeTeam.name} vs ${match.awayTeam.name}`);

          // 1. 补充进球详情
          const enrichedMatch = await enrichMatchWithDetails(match);

          // 2. 更新原始比赛数据
          apiData.matches[apiData.matches.findIndex(m => m.id === match.id)] = enrichedMatch;

          // 3. 重新生成 ICS 文件
          generateAndSaveICal(apiData.matches, 2026, 'WorldCupSchedule.ics');
          console.log('✓ ICS 文件已更新');

          // 4. 更新状态
          await updateStateTracker(matchId, {
            status: 'FINISHED',
            enrichedAt: new Date().toISOString()
          });

          console.log(`✓ 比赛已处理: ${match.homeTeam.name} ${match.score.fullTime.home}-${match.score.fullTime.away} ${match.awayTeam.name}`);
        }
      }
    }

    // 使用智能调度算法计算下次检查时间
    nextCheckTime = calculateNextCheckTime(apiData.matches);

    if (nextCheckTime) {
      const nextMatch = getNextUnfinishedMatch(apiData.matches);
      if (nextMatch) {
        const taipeiTime = moment(nextMatch.utcDate).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm');
        console.log(`\n下一场比赛: ${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}`);
        console.log(`北京时间: ${taipeiTime}`);

        const nextCheckTaipei = nextCheckTime.clone().tz('Asia/Shanghai');
        const intervalHours = nextCheckTime.diff(moment().utc(), 'hours', true);
        console.log(`\n📋 智能调度：间隔 ${intervalHours.toFixed(2)} 小时`);
        console.log(`下次检查时间（北京时间）: ${nextCheckTaipei.format('YYYY-MM-DD HH:mm:ss')}`);

        if (intervalHours > 2) {
          console.log('✅ 间隔 > 2小时，将在比赛结束后检查');
        } else {
          console.log('⚠️ 间隔 ≤ 2小时，5分钟小循环检查中...');
        }
      }
    }

    return { nextCheckTime: nextCheckTime?.toDate() };

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
    const estimatedEndTime = calculateMatchEndTime(m);
    return now.isAfter(estimatedEndTime) && m.status !== 'FINISHED';
  });
}

/**
 * 以 5 分钟间隔重复检查，直到获取到比分
 */
export async function checkWithRetry() {
  let retryCount = 0;
  const maxRetries = 360; // 30小时（5分钟/次）

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
        console.error('超出最大重试次数，放弃');
        throw error;
      }
    }
  }

  throw new Error('5 分钟检查循环超时');
}
