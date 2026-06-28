import 'dotenv/config';
import { fetchWorldCupMatches } from './src/api.js';
import { getAllMatches as getDongqiudiMatches } from './src/dongqiudi-api.js';
import { getAllMatches as getCCTVMatches } from './src/cctv-api.js';
import { generateAndSaveICal } from './src/ical-generator.js';
import { normalizeTeamName } from './src/team-mapper.js';

/**
 * 生成比赛唯一键
 */
function generateMatchKey(match) {
  const dateStr = match.utcDate ? match.utcDate.split('T')[0] : '';
  const home = match.homeTeam?.name || '';
  const away = match.awayTeam?.name || '';
  const homeEn = normalizeTeamName(home).toLowerCase().replace(/\s+/g, '');
  const awayEn = normalizeTeamName(away).toLowerCase().replace(/\s+/g, '');

  return `${dateStr}_${homeEn}_vs_${awayEn}`;
}

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
 * 策略：以 FIFA 的 104 场比赛时间为准，用懂球帝/CCTV 补充球队名和比分
 * 注意：不依赖阶段匹配，只用时间匹配（因为不同数据源的阶段名称不一致）
 */
function enrichFIFAMatches(fifaMatches, dongqiudiMatches, cctvMatches) {
  console.log('\n正在补充淘汰赛对阵信息...');

  // 合并所有补充数据源（CCTV 优先，因为它有更多确定的对阵）
  const allSupplementMatches = [...cctvMatches, ...dongqiudiMatches];

  let enrichedCount = 0;
  const knockoutStages = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

  // 遍历 FIFA 的比赛，补充淘汰赛的对阵信息
  const enrichedMatches = fifaMatches.map(fifaMatch => {
    // 只处理淘汰赛
    if (!knockoutStages.includes(fifaMatch.stage)) {
      return fifaMatch;
    }

    // 如果 FIFA 数据中球队已确定，不需要补充
    if (fifaMatch.homeTeam?.name && fifaMatch.awayTeam?.name) {
      return fifaMatch;
    }

    // 尝试从补充数据源中找到时间最接近的比赛
    let bestMatch = null;
    let minTimeDiff = Infinity;

    for (const supplement of allSupplementMatches) {
      // 必须有完整的球队信息
      if (!supplement.homeTeam?.name || !supplement.awayTeam?.name) {
        continue;
      }

      // 计算时间差（小时）
      const timeDiff = getTimeDifference(fifaMatch.utcDate, supplement.utcDate);

      // 时间差必须在 4 小时内（严格匹配，避免误匹配）
      if (timeDiff > 4) {
        continue;
      }

      // 找到时间最接近的匹配
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        bestMatch = supplement;
      }
    }

    // 如果找到匹配，补充球队信息
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

    // 没有找到补充数据，返回原始 FIFA 数据
    return fifaMatch;
  });

  console.log(`   - 补充了 ${enrichedCount} 场淘汰赛的对阵信息`);

  return enrichedMatches;
}

/**
 * 主函数 - 获取世界杯数据并生成iCal日历文件
 */
async function main() {
  try {
    console.log('启动世界杯日历生成器...');

    const season = parseInt(process.env.SEASON_YEAR || '2026');
    console.log(`获取赛季数据: ${season}`);

    // 1. 从 FIFA 官方 API 获取 104 场标准赛程
    console.log('\n🌍 从 FIFA 官方 API 获取标准赛程（主数据源）...');
    const apiData = await fetchWorldCupMatches(season);

    if (!apiData || !apiData.matches || apiData.matches.length === 0) {
      throw new Error('FIFA API 响应中未找到比赛数据');
    }

    console.log(`✅ 获得 ${apiData.matches.length} 场比赛（标准赛程）`);

    // 2. 从懂球帝获取数据（用于补充淘汰赛对阵）
    console.log('\n🏆 从懂球帝获取数据（补充淘汰赛对阵）...');
    let dongqiudiMatches = [];
    try {
      dongqiudiMatches = await getDongqiudiMatches();
      console.log(`✅ 获得 ${dongqiudiMatches.length} 场比赛`);
    } catch (error) {
      console.warn('⚠️  懂球帝 API 调用失败');
      console.warn('   错误:', error.message);
    }

    // 3. 从 CCTV 体育获取数据（补充淘汰赛对阵）
    console.log('\n📺 从 CCTV 体育获取数据（补充淘汰赛对阵）...');
    let cctvMatches = [];
    try {
      cctvMatches = await getCCTVMatches();
      console.log(`✅ 获得 ${cctvMatches.length} 场比赛`);
    } catch (error) {
      console.warn('⚠️  CCTV 体育 API 调用失败');
      console.warn('   错误:', error.message);
    }

    // 4. 补充 FIFA 数据中缺失的淘汰赛对阵信息
    const enrichedMatches = enrichFIFAMatches(
      apiData.matches,
      dongqiudiMatches,
      cctvMatches
    );

    console.log(`\n📅 准备生成日历，共 ${enrichedMatches.length} 场比赛`);

    // 5. 生成日历
    generateAndSaveICal(enrichedMatches, season);

    console.log('\n✅ 世界杯日历生成成功！');
    console.log(`   文件: WorldCupSchedule.ics`);

    process.exit(0);

  } catch (error) {
    console.error('❌ 生成日历失败:', error.message);
    console.error('错误堆栈:', error.stack);

    if (process.env.GITHUB_ACTIONS === 'true') {
      console.log('::error::生成日历失败: ' + error.message);
    }

    process.exit(1);
  }
}

main();
