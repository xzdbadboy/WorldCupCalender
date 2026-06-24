#!/usr/bin/env node

import 'dotenv/config';
import moment from 'moment-timezone';
import { checkAndUpdateMatches } from './src/match-updater.js';

/**
 * 主程序入口
 *
 * 用法:
 *   node monitor-match.js          # 执行一次检查
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`[${moment().utc().toISOString()}] 世界杯比赛监控系统启动`);
  console.log('='.repeat(60) + '\n');

  try {
    await checkAndUpdateMatches();

    console.log('\n' + '='.repeat(60));
    console.log('检查完成，将在 20 分钟后再次自动检查');
    console.log('='.repeat(60));

    process.exit(0);

  } catch (error) {
    console.error('\n致命错误:', error.message);
    console.error(error.stack);

    process.exit(1);
  }
}

main();
