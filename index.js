import 'dotenv/config';
import { fetchWorldCupMatches } from './src/api.js';
import { getKnockoutMatches } from './src/fifa-api.js';
import { generateAndSaveICal } from './src/ical-generator.js';

/**
 * 合并 football-data.org 和 FIFA 官方 API 的数据
 * @param {Array} footballDataMatches - football-data.org 的比赛数据
 * @param {Array} fifaMatches - FIFA 官方 API 的比赛数据
 * @returns {Array} 合并后的比赛数据
 */
function mergeMatchData(footballDataMatches, fifaMatches) {
  console.log('正在合并两个数据源...');

  // 淘汰赛阶段列表
  const knockoutStages = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

  // 过滤掉 football-data.org 中的淘汰赛占位数据（球队为 null 的）
  const groupStageMatches = footballDataMatches.filter(match => {
    // 保留小组赛
    if (match.stage === 'GROUP_STAGE') {
      return true;
    }
    // 保留有完整球队信息的淘汰赛
    if (knockoutStages.includes(match.stage)) {
      return match.homeTeam?.name && match.awayTeam?.name;
    }
    return true;
  });

  console.log(`   - football-data.org: ${footballDataMatches.length} 场 → 过滤后 ${groupStageMatches.length} 场`);

  // 创建一个 Set 来去重（基于时间和阶段）
  const existingMatches = new Set();
  groupStageMatches.forEach(match => {
    const key = `${match.utcDate}_${match.stage}`;
    existingMatches.add(key);
  });

  // 添加 FIFA 的淘汰赛数据
  const mergedMatches = [...groupStageMatches];
  let addedCount = 0;

  fifaMatches.forEach(fifaMatch => {
    const key = `${fifaMatch.utcDate}_${fifaMatch.stage}`;

    // 如果不存在，则添加
    if (!existingMatches.has(key)) {
      mergedMatches.push(fifaMatch);
      existingMatches.add(key);
      addedCount++;
    }
  });

  console.log(`✅ 数据合并完成:`);
  console.log(`   - 小组赛: ${groupStageMatches.length} 场`);
  console.log(`   - 新增淘汰赛: ${addedCount} 场`);
  console.log(`   - 总比赛数: ${mergedMatches.length} 场`);

  return mergedMatches;
}

/**
 * 主函数 - 获取世界杯数据并生成iCal日历文件
 * @async
 * @function main
 * @returns {Promise<void>}
 */
async function main() {
  try {
    console.log('启动世界杯日历生成器...');

    const season = parseInt(process.env.SEASON_YEAR || '2026');
    console.log(`获取赛季数据: ${season}`);

    // 1. 从 football-data.org 获取小组赛数据
    console.log('\n📡 从 football-data.org 获取数据...');
    const apiData = await fetchWorldCupMatches(season);

    if (!apiData || !apiData.matches || apiData.matches.length === 0) {
      throw new Error('API响应中未找到比赛数据');
    }

    console.log(`✅ 获得 ${apiData.matches.length} 场比赛`);

    // 2. 从 FIFA 官方 API 获取淘汰赛数据
    console.log('\n🏆 从 FIFA 官方 API 获取淘汰赛数据...');
    let fifaMatches = [];
    try {
      fifaMatches = await getKnockoutMatches();
      console.log(`✅ 获得 ${fifaMatches.length} 场淘汰赛`);
    } catch (error) {
      console.warn('⚠️  FIFA API 调用失败，将仅使用 football-data.org 数据');
      console.warn('   错误:', error.message);
    }

    // 3. 合并数据
    const allMatches = fifaMatches.length > 0
      ? mergeMatchData(apiData.matches, fifaMatches)
      : apiData.matches;

    console.log(`\n📅 准备生成日历，共 ${allMatches.length} 场比赛`);

    // 4. 生成日历
    generateAndSaveICal(allMatches, season);

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
