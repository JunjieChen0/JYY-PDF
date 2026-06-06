/**
 * OCR 语言数据管理工具
 * 支持离线下载和管理 Tesseract 语言数据
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream');
const { promisify } = require('util');

const streamPipeline = promisify(pipeline);

// 支持的语言列表
const SUPPORTED_LANGUAGES = [
  { code: 'chi_sim', name: '简体中文' },
  { code: 'chi_tra', name: '繁体中文' },
  { code: 'eng', name: 'English' },
  { code: 'jpn', name: '日本語' },
  { code: 'kor', name: '한국어' },
  { code: 'deu', name: 'Deutsch' },
  { code: 'fra', name: 'Français' },
  { code: 'spa', name: 'Español' },
  { code: 'rus', name: 'Русский' },
];

// 语言数据 CDN 地址
const LANG_DATA_BASE_URL = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data';

/**
 * 获取语言数据目录路径
 */
function getLangDataPath() {
  const publicDir = path.join(__dirname, '..', 'public', 'tesseract', 'langs');
  return publicDir;
}

/**
 * 检查语言数据是否已下载
 */
function isLanguageDownloaded(langCode) {
  const langPath = path.join(getLangDataPath(), `${langCode}.traineddata.gz`);
  return fs.existsSync(langPath);
}

/**
 * 下载语言数据文件
 */
async function downloadLanguageData(langCode) {
  const langDir = getLangDataPath();
  
  // 创建目录
  if (!fs.existsSync(langDir)) {
    fs.mkdirSync(langDir, { recursive: true });
  }

  const filePath = path.join(langDir, `${langCode}.traineddata.gz`);
  
  // 如果已存在，跳过下载
  if (fs.existsSync(filePath)) {
    console.log(`✓ ${langCode} 语言数据已存在`);
    return filePath;
  }

  const url = `${LANG_DATA_BASE_URL}/${langCode}/${langCode}.traineddata.gz`;
  
  return new Promise((resolve, reject) => {
    console.log(`正在下载 ${langCode} 语言数据...`);
    
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        fs.unlinkSync(filePath);
        reject(new Error(`下载失败：HTTP ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      const progressInterval = setInterval(() => {
        const percent = ((downloadedSize / totalSize) * 100).toFixed(2);
        process.stdout.write(`\r下载进度：${percent}%`);
      }, 500);

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
      });

      streamPipeline(response, file)
        .then(() => {
          clearInterval(progressInterval);
          console.log(`\n✓ ${langCode} 语言数据下载完成`);
          resolve(filePath);
        })
        .catch((err) => {
          clearInterval(progressInterval);
          fs.unlinkSync(filePath);
          reject(err);
        });
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });
}

/**
 * 下载所有常用语言数据
 */
async function downloadAllLanguages() {
  const commonLangs = ['chi_sim', 'chi_tra', 'eng'];
  
  console.log('开始下载常用语言数据...\n');
  
  for (const lang of commonLangs) {
    try {
      await downloadLanguageData(lang);
    } catch (err) {
      console.error(`\n✗ ${lang} 下载失败：`, err.message);
    }
  }
  
  console.log('\n语言数据下载完成！');
}

/**
 * 列出已下载的语言
 */
function listDownloadedLanguages() {
  const langDir = getLangDataPath();
  
  if (!fs.existsSync(langDir)) {
    console.log('暂无已下载的语言数据');
    return [];
  }

  const files = fs.readdirSync(langDir);
  const downloaded = files
    .filter(f => f.endsWith('.traineddata.gz'))
    .map(f => f.replace('.traineddata.gz', ''));

  console.log('已下载的语言数据:');
  downloaded.forEach(lang => {
    const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang);
    const name = langInfo ? langInfo.name : lang;
    const status = isLanguageDownloaded(lang) ? '✓' : '✗';
    console.log(`  ${status} ${lang} (${name})`);
  });

  return downloaded;
}

/**
 * 删除语言数据
 */
function removeLanguageData(langCode) {
  const filePath = path.join(getLangDataPath(), `${langCode}.traineddata.gz`);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✓ 已删除 ${langCode} 语言数据`);
    return true;
  } else {
    console.log(`${langCode} 语言数据不存在`);
    return false;
  }
}

// CLI 命令处理
async function main() {
  const command = process.argv[2];
  const langCode = process.argv[3];

  switch (command) {
    case 'download':
      if (langCode) {
        await downloadLanguageData(langCode);
      } else {
        await downloadAllLanguages();
      }
      break;
    
    case 'list':
      listDownloadedLanguages();
      break;
    
    case 'remove':
      if (langCode) {
        removeLanguageData(langCode);
      } else {
        console.log('请指定要删除的语言代码');
      }
      break;
    
    case 'check':
      if (langCode) {
        const exists = isLanguageDownloaded(langCode);
        console.log(`${langCode}: ${exists ? '已下载' : '未下载'}`);
      } else {
        listDownloadedLanguages();
      }
      break;
    
    default:
      console.log(`
OCR 语言数据管理工具

用法:
  node manage-ocr-langs.js download [lang]  - 下载语言数据 (不指定 lang 则下载常用语言)
  node manage-ocr-lang.js list              - 列出已下载的语言
  node manage-ocr-langs.js remove <lang>    - 删除指定语言数据
  node manage-ocr-langs.js check [lang]     - 检查语言数据状态

支持的语言:
${SUPPORTED_LANGUAGES.map(l => `  ${l.code.padEnd(10)} - ${l.name}`).join('\n')}
`);
  }
}

main().catch(console.error);

module.exports = {
  SUPPORTED_LANGUAGES,
  isLanguageDownloaded,
  downloadLanguageData,
  downloadAllLanguages,
  listDownloadedLanguages,
  removeLanguageData,
  getLangDataPath,
};
