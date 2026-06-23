import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_DIR = path.join(__dirname, '..', '.state');
const STATE_FILE = path.join(STATE_DIR, 'tracker.json');

/**
 * 确保状态目录存在
 */
function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * 初始化状态文件
 */
function initializeState() {
  return {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    processedMatches: {}
  };
}

/**
 * 读取状态文件
 */
export async function getStateTracker() {
  ensureStateDir();

  try {
    if (fs.existsSync(STATE_FILE)) {
      const content = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('读取状态文件失败:', error.message);
  }

  return initializeState();
}

/**
 * 更新单个比赛的处理状态
 */
export async function updateStateTracker(matchId, updateData) {
  ensureStateDir();

  try {
    const state = await getStateTracker();

    if (!state.processedMatches) {
      state.processedMatches = {};
    }

    state.processedMatches[matchId] = {
      ...state.processedMatches[matchId],
      ...updateData,
      lastUpdatedAt: new Date().toISOString()
    };

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`状态已更新: 比赛 ${matchId}`);

    return state;

  } catch (error) {
    console.error('更新状态文件失败:', error.message);
    throw error;
  }
}

/**
 * 清空状态（用于测试或重新开始）
 */
export async function clearStateTracker() {
  ensureStateDir();

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(initializeState(), null, 2));
    console.log('状态已清空');
  } catch (error) {
    console.error('清空状态失败:', error.message);
    throw error;
  }
}
