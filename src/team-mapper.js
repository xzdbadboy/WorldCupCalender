import fs from 'fs';
import path from 'path';

let teamInfoCache = null;

/**
 * 加载队伍信息数据
 * @function loadTeamInfo
 * @returns {Array<Object>} 队伍信息数组
 */
function loadTeamInfo() {
  if (teamInfoCache) {
    return teamInfoCache;
  }

  try {
    const teamInfoPath = path.join(process.cwd(), 'src', 'teamInfo_2026.json');
    const teamInfo = JSON.parse(fs.readFileSync(teamInfoPath, 'utf8'));

    teamInfoCache = teamInfo;
    return teamInfo;
  } catch (error) {
    console.error('加载队伍信息失败:', error.message);
    return [];
  }
}

/**
 * 队伍名称别名映射
 * @constant {Object}
 */
const TEAM_ALIASES = {
  'Cape Verde Islands': 'Cape Verde',
  'Cabo Verde': 'Cape Verde',
  'Korea Republic': 'South Korea',
  'USA': 'United States',
  'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
  'Côte d\'Ivoire': 'Ivory Coast',
  '刚果民主共和国': 'Congo DR',
  '刚果（金）': 'Congo DR',
  '佛得角 ': 'Cape Verde', // 注意：懂球帝的数据有尾随空格
  '佛得角': 'Cape Verde'
};

/**
 * 获取队伍的中文名称和国旗
 * @function getTeamMapping
 * @param {string} teamName - 队伍英文名称
 * @returns {Object} 包含nameCn和flag属性的对象
 * @example
 * const team = getTeamMapping('Brazil');
 * console.log(team); // { nameCn: '巴西', flag: '🇧🇷' }
 */
export function getTeamMapping(teamName) {
  if (!teamName) {
    return {
      nameCn: '待定',
      flag: '❔'
    };
  }

  const teamInfo = loadTeamInfo();

  const normalizedName = TEAM_ALIASES[teamName] || teamName;

  const team = teamInfo.find(t =>
    t.nameEn === normalizedName ||
    t.nameEn.toLowerCase() === normalizedName.toLowerCase() ||
    t.nameCn === normalizedName
  );

  if (team) {
    return {
      nameCn: team.nameCn,
      flag: team.flag
    };
  }

  console.warn(`未找到队伍映射: ${teamName}`);
  return {
    nameCn: teamName,
    flag: '❔'
  };
}

/**
 * 将队伍名称（中文或英文）标准化为英文
 * @function normalizeTeamName
 * @param {string} teamName - 队伍名称（中文或英文）
 * @returns {string} 标准化后的英文队名
 * @example
 * normalizeTeamName('巴西'); // 返回 'Brazil'
 * normalizeTeamName('Brazil'); // 返回 'Brazil'
 */
export function normalizeTeamName(teamName) {
  if (!teamName) {
    return '';
  }

  const teamInfo = loadTeamInfo();

  // 先检查别名
  const normalizedName = TEAM_ALIASES[teamName] || teamName;

  // 查找匹配的队伍
  const team = teamInfo.find(t =>
    t.nameEn === normalizedName ||
    t.nameEn.toLowerCase() === normalizedName.toLowerCase() ||
    t.nameCn === normalizedName ||
    t.nameCn === teamName
  );

  if (team) {
    return team.nameEn;
  }

  // 如果找不到，返回原名
  return teamName;
}

/**
 * 构建队伍名称映射表
 * @deprecated 导出但未在任何活跃模块中导入。仅通过 getTeamMapping 进行查询。
 * @function buildTeamNameMap
 * @returns {Object} 队伍名称映射对象，键为英文名，值为包含中文名和国旗的对象
 */
export function buildTeamNameMap() {
  const teamInfo = loadTeamInfo();
  const nameMap = {};

  teamInfo.forEach(team => {
    nameMap[team.nameEn] = {
      nameCn: team.nameCn,
      flag: team.flag
    };

    if (team.nameEn.toLowerCase() !== team.nameEn) {
      nameMap[team.nameEn.toLowerCase()] = {
        nameCn: team.nameCn,
        flag: team.flag
      };
    }
  });

  return nameMap;
}

/**
 * 从分组名称中提取分组字母
 * @function getGroupLetter
 * @param {string} groupName - 分组名称（如 'GROUP_A'）
 * @returns {string} 分组字母（如 'A'）
 * @example
 * getGroupLetter('GROUP_A'); // 返回 'A'
 */
export function getGroupLetter(groupName) {
  if (!groupName) {
    return '?';
  }

  const match = groupName.match(/GROUP_([A-Z])/);
  if (match) {
    return match[1];
  }

  if (groupName.includes('GROUP')) {
    const letter = groupName.replace('GROUP', '').replace('_', '').trim();
    return letter || '?';
  }

  return groupName;
}

/**
 * 获取比赛阶段的中文名称
 * @function getStageName
 * @param {string} stage - 比赛阶段枚举值
 * @returns {string} 比赛阶段的中文名称
 * @example
 * getStageName('GROUP_STAGE'); // 返回 '小组赛'
 * getStageName('FINAL'); // 返回 '决赛'
 */
export function getStageName(stage) {
  const stageMap = {
    'GROUP_STAGE': '小组赛',
    'LAST_32': '32强赛',
    'LAST_16': '16强赛',
    'QUARTER_FINALS': '1/4决赛',
    'SEMI_FINALS': '半决赛',
    'THIRD_PLACE': '季军赛',
    'FINAL': '决赛'
  };

  return stageMap[stage] || stage || '比赛';
}

/**
 * 格式化比赛标题
 * @function formatMatchTitle
 * @param {Object} match - 比赛对象
 * @param {Object} match.homeTeam - 主队信息
 * @param {string} match.homeTeam.name - 主队名称
 * @param {Object} match.awayTeam - 客队信息
 * @param {string} match.awayTeam.name - 客队名称
 * @param {string} match.group - 分组名称
 * @param {string} match.stage - 比赛阶段
 * @returns {string} 格式化的比赛标题
 * @example
 * const title = formatMatchTitle(match);
 * // 返回: 'A组-墨西哥🇲🇽vs南非🇿🇦'
 */
export function formatMatchTitle(match, matchResult, homeTeam, awayTeam) {
  // 如果已提供已解析的队伍信息则直接使用，避免重复查询
  if (!homeTeam) homeTeam = getTeamMapping(match.homeTeam?.name);
  if (!awayTeam) awayTeam = getTeamMapping(match.awayTeam?.name);
  const group = getGroupLetter(match.group);
  const stage = getStageName(match.stage);

  let title = '';

  if (match.stage === 'GROUP_STAGE') {
    title = `${group}组-`;
  } else {
    title = `${stage}-`;
  }

  title += matchResult ? matchResult : `${homeTeam.nameCn}${homeTeam.flag}vs${awayTeam.nameCn}${awayTeam.flag}`;

  return title;
}
