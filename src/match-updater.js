import 'dotenv/config';
import moment from 'moment-timezone';
import { fetchWorldCupMatches } from './api.js';
import { getAllMatches as getDongqiudiMatches } from './dongqiudi-api.js';
import { getAllMatches as getCCTVMatches } from './cctv-api.js';
import { generateAndSaveICal } from './ical-generator.js';
import { getStateTracker, updateStateTracker } from './state-tracker.js';
import { normalizeTeamName } from './team-mapper.js';

/**
 * 计算两个时间的相似度（小时差）
 */
function getTimeDifference(time1, time2) {
  const date1 = new Date(time1);
  const date2 = new Date(time2);
  return Math.abs(date1 - date2) / (1000 * 60 * 60); // 返回小时差
}

/**
 * 补充 FIFA 数据中缺失的淘汰赛对阵信息
 */
function enrichFIFAMatches(fifaMatches, dongqiudiMatches, cctvMatches) {
  // 合并所有补充数据源（CCTV 优先）
  const allSupplementMatches = [...cctvMatches, ...dongqiudiMatches];

  let enrichedCount = 0;
  const knockoutStages = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

  const enrichedMatches = fifaMatches.map(fifaMatch => {
    if (!knockoutStages.includes(fifaMatch.stage)) {
      return fifaMatch;
    }

    if (fifaMatch.homeTeam?.name && fifaMatch.awayTeam?.name) {
      return fifaMatch;
    }

    let bestMatch = null;
    let minTimeDiff = Infinity;

    for (const supplement of allSupplementMatches) {
      if (!supplement.homeTeam?.name || !supplement.awayTeam?.name) {
        continue;
      }

      const timeDiff = getTimeDifference(fifaMatch.utcDate, supplement.utcDate);

      if (timeDiff > 4) {
        continue;
      }

      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        bestMatch = supplement;
      }
    }

    if (bestMatch) {
      enrichedCount++;
      return {
        ...fifaMatch,
        homeTeam: bestMatch.homeTeam,
        awayTeam: bestMatch.awayTeam,
        score: bestMatch.score || fifaMatch.score,
        status: bestMatch.status || fifaMatch.status,
        enrichedFrom: bestMatch.source
      };
    }

    return fifaMatch;
  });

  if (enrichedCount > 0) {
    console.log(`   - 补充了 ${enrichedCount} 场淘汰赛的对阵信息`);
  }

  return enrichedMatches;
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
  return match.status === 'FINISHED' &&
    match.score?.fullTime?.home != null &&
    match.score?.fullTime?.away != null;
}

/**
 * 主处理逻辑
 */
export async function checkAndUpdateMatches() {
  try {
    console.log(`\n[${moment().utc().toISOString()}] 开始检查比赛数据...`);

    // 1. 获取 FIFA 官方数据
    const season = 2026;
    const apiData = await fetchWorldCupMatches(season);

    // 2. 获取补充数据源
    let dongqiudiMatches = [];
    let cctvMatches = [];

    try {
      dongqiudiMatches = await getDongqiudiMatches();
    } catch (error) {
      console.warn('⚠️  懂球帝 API 调用失败');
    }

    try {
      cctvMatches = await getCCTVMatches();
    } catch (error) {
      console.warn('⚠️  CCTV 体育 API 调用失败');
    }

    // 3. 补充淘汰赛对阵信息
    const enrichedMatches = enrichFIFAMatches(apiData.matches, dongqiudiMatches, cctvMatches);

    const todayMatches = getTodayMatches(enrichedMatches);

    console.log(`今天找到 ${todayMatches.length} 场比赛`);

    if (todayMatches.length === 0) {
      console.log('今天没有比赛，任务结束');
      return {};
    }

    const state = await getStateTracker();

    // 收集需要处理的比赛中，最后统一更新 ICS 文件
    const processedIds = [];

    // 处理已完成的比赛
    for (const match of todayMatches) {
      const matchId = match.id;
      const isProcessed = state.processedMatches?.[matchId];

      if (isMatchFinished(match)) {
        if (!isProcessed) {
          console.log(`处理已完成比赛: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
          processedIds.push(match);

          // 更新状态
          await updateStateTracker(matchId, {
            status: 'FINISHED',
            enrichedAt: moment().utc().toISOString()
          });

          console.log(`✓ 比赛已处理: ${match.homeTeam.name} ${match.score.fullTime.home}-${match.score.fullTime.away} ${match.awayTeam.name}`);
        }
      }
    }

    // 有新增完成的比赛时，统一更新一次 ICS 文件（使用补充后的数据）
    if (processedIds.length > 0) {
      generateAndSaveICal(enrichedMatches, 2026, 'WorldCupSchedule.ics');
      console.log(`✓ ICS 文件已更新（${processedIds.length} 场比赛）`);
    } else {
      // 即使没有新完成的比赛，也更新一次日历（确保淘汰赛对阵信息是最新的）
      generateAndSaveICal(enrichedMatches, 2026, 'WorldCupSchedule.ics');
      console.log(`✓ ICS 文件已更新（保持淘汰赛对阵最新）`);
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
 *
 * @deprecated 自固定 20 分钟检查架构后不再使用。保留以防未来需要恢复智能调度。
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
 *
 * @deprecated 自固定 20 分钟检查架构后不再使用（无任何模块导入此函数）。
 *             checkAndUpdateMatches 已不再返回 nextCheckTime，此函数中的调度逻辑已失效。
 *             保留以防未来需要恢复智能调度。
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
