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
      } else {
        // 未结束的比赛 - 计算下一次检查时间
        const matchTime = moment(match.utcDate);
        const estimatedEndTime = matchTime.clone().add(2, 'hours'); // 90分钟 + 伤停补时
        const checkTime = estimatedEndTime.clone().add(5, 'minutes'); // 每5分钟检查

        if (!nextCheckTime || checkTime.isBefore(nextCheckTime)) {
          nextCheckTime = checkTime;
        }

        const taipeiTime = moment(match.utcDate).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm');
        console.log(`待开始: ${match.homeTeam.name} vs ${match.awayTeam.name} (北京时间: ${taipeiTime})`);
      }
    }

    // 如果今天没有待开始的比赛，找最近的下一场比赛
    if (!nextCheckTime) {
      const now = moment().utc();
      const futureMatches = apiData.matches
        .filter(m => moment(m.utcDate).utc().isAfter(now) && m.status !== 'FINISHED')
        .sort((a, b) => moment(a.utcDate).utc() - moment(b.utcDate).utc());

      if (futureMatches.length > 0) {
        const nextMatch = futureMatches[0];
        const matchTime = moment(nextMatch.utcDate);
        const estimatedEndTime = matchTime.clone().add(2, 'hours');
        nextCheckTime = estimatedEndTime.clone().add(5, 'minutes');

        const taipeiTime = moment(nextMatch.utcDate).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm');
        console.log(`\n下一场比赛: ${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name}`);
        console.log(`北京时间: ${taipeiTime}`);
      }
    }

    return { nextCheckTime: nextCheckTime?.toDate() };

  } catch (error) {
    console.error('比赛检查失败:', error.message);
    throw error;
  }
}

/**
 * 以 5 分钟间隔重复检查，直到获取到比分
 */
export async function checkWithRetry() {
  try {
    const result = await checkAndUpdateMatches();

    if (result.nextCheckTime) {
      const taipei = moment(result.nextCheckTime).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      console.log(`\n下一次检查时间（北京时间）: ${taipei}`);
      return result.nextCheckTime;
    }

    return null;

  } catch (error) {
    console.error('检查失败，5分钟后重试:', error.message);
    const retryTime = new Date(Date.now() + 5 * 60 * 1000);
    console.log(`重试时间: ${moment(retryTime).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')}`);
    return retryTime;
  }
}
