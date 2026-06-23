#!/usr/bin/env node

import 'dotenv/config';
import moment from 'moment-timezone';
import { checkWithRetry } from './src/match-updater.js';
import { setNextCheckTime } from './src/state-tracker.js';

/**
 * 主程序入口
 * 支持通过 CronCreate 的链式调用
 *
 * 用法:
 *   node monitor-match.js          # 执行一次检查
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`[${new Date().toISOString()}] 世界杯比赛监控系统启动`);
  console.log('='.repeat(60) + '\n');

  try {
    const nextCheckTime = await checkWithRetry();

    if (nextCheckTime) {
      // 保存下一个检查时间到状态
      await setNextCheckTime(nextCheckTime);

      const taipei = moment(nextCheckTime)
        .tz('Asia/Shanghai')
        .format('YYYY-MM-DD HH:mm:ss');

      console.log('\n' + '='.repeat(60));
      console.log(`下一次自动检查时间（北京时间）: ${taipei}`);
      console.log(`UTC 时间: ${moment(nextCheckTime).utc().format('YYYY-MM-DD HH:mm:ss')}`);
      console.log('='.repeat(60));

      // 输出 JSON 格式的下一个任务信息（供 CronCreate 使用）
      console.log(JSON.stringify({
        success: true,
        nextCheckTime: nextCheckTime.toISOString(),
        nextCheckTimeTaipei: taipei,
        message: '请使用此时间创建下一个 CronCreate 任务'
      }));

    } else {
      console.log('\n没有待检查的比赛，世界杯已结束');
      console.log(JSON.stringify({
        success: true,
        nextCheckTime: null,
        message: '世界杯赛程已完成'
      }));
    }

    process.exit(0);

  } catch (error) {
    console.error('\n致命错误:', error.message);
    console.error(error.stack);

    console.log(JSON.stringify({
      success: false,
      error: error.message,
      message: '执行失败，请检查日志'
    }));

    process.exit(1);
  }
}

// 运行主程序
main();
