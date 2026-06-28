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
 * 补充 FIFA 数据中缺失的淘汰赛对阵信息
 * 策略：以 FIFA 的 104 场比赛时间为准，用懂球帝/CCTV 补充球队名和比分
 */
function enrichFIFAMatches(fifaMatches, dongqiudiMatches, cctvMatches) {
  console.log('\n正在补充淘汰赛对阵信息...');

  // 创建补充数据源的索引
  const supplementMap = new Map();

  // 添加懂球帝数据
  dongqiudiMatches.forEach(match => {
    if (match.homeTeam?.name && match.awayTeam?.name) {
      const key = generateMatchKey(match);
      supplementMap.set(key, { ...match, source: 'dongqiudi' });

      // 同时添加前后一天的键（处理时区差异）
      const date = new Date(match.utcDate.split('T')[0]);
      [-1, 1].forEach(offset => {
        const d = new Date(date);
        d.setDate(d.getDate() + offset);
        const altKey = `${d.toISOString().split('T')[0]}_${normalizeTeamName(match.homeTeam.name).toLowerCase().replace(/\s+/g, '')}_vs_${normalizeTeamName(match.awayTeam.name).toLowerCase().replace(/\s+/g, '')}`;
        if (!supplementMap.has(altKey)) {
          supplementMap.set(altKey, { ...match, source: 'dongqiudi' });
        }
      });
    }
  });

  // 添加 CCTV 数据（优先级低于懂球帝）
  cctvMatches.forEach(match => {
    if (match.homeTeam?.name && match.awayTeam?.name) {
      const key = generateMatchKey(match);
      if (!supplementMap.has(key)) {
        supplementMap.set(key, { ...match, source: 'cctv' });

        // 同样添加前后一天的键
        const date = new Date(match.utcDate.split('T')[0]);
        [-1, 1].forEach(offset => {
          const d = new Date(date);
          d.setDate(d.getDate() + offset);
          const altKey = `${d.toISOString().split('T')[0]}_${normalizeTeamName(match.homeTeam.name).toLowerCase().replace(/\s+/g, '')}_vs_${normalizeTeamName(match.awayTeam.name).toLowerCase().replace(/\s+/g, '')}`;
          if (!supplementMap.has(altKey)) {
            supplementMap.set(altKey, { ...match, source: 'cctv' });
          }
        });
      }
    }
  });

  let enrichedCount = 0;
  const knockoutStages = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

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

    // 尝试从补充数据源中找到匹配的比赛
    const dateStr = fifaMatch.utcDate ? fifaMatch.utcDate.split('T')[0] : '';

    // 尝试匹配相同日期和阶段的比赛
    for (const [key, supplement] of supplementMap.entries()) {
      if (key.startsWith(dateStr) && supplement.stage === fifaMatch.stage) {
        // 找到匹配，补充球队信息和比分
        enrichedCount++;
        return {
          ...fifaMatch,
          homeTeam: supplement.homeTeam,
          awayTeam: supplement.awayTeam,
          score: supplement.score || fifaMatch.score,
          status: supplement.status || fifaMatch.status,
          enrichedFrom: supplement.source
        };
      }
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
