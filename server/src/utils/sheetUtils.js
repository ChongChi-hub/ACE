/**
 * Tiện ích xử lý công thức và giá trị trong Google Sheets
 */

/**
 * Chuyển chỉ số cột (1-indexed) thành chữ cái (ví dụ: 1 -> A, 2 -> B, 22 -> V, 27 -> AA)
 */
export function colIndexToLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    let remainder = (temp - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    temp = Math.floor((temp - remainder) / 26);
  }
  return letter;
}

/**
 * Chuyển chữ cái cột thành chỉ số (1-indexed) (ví dụ: A -> 1, V -> 22)
 */
export function letterToColIndex(letter) {
  let column = 0;
  const upper = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    column = column * 26 + (upper.charCodeAt(i) - 64);
  }
  return column;
}

/**
 * Chống Formula Injection:
 * Nếu chuỗi bắt đầu bằng '=', '+', '-', '@' thì thêm dấu nháy đơn '\'' ở đầu
 */
export function sanitizeSheetValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (['=', '+', '-', '@'].includes(trimmed.charAt(0))) {
    return `'${value}`;
  }
  return value;
}

/**
 * Parse ô công thức HYPERLINK thành { name, url }
 * Ví dụ: =HYPERLINK("https://facebook.com/user#", "Nguyễn Văn A")
 */
export function parseHyperlink(cellValue) {
  if (!cellValue) return { name: '', url: '' };
  const str = String(cellValue).trim();

  // Match: =HYPERLINK("url", "name") hoặc =HYPERLINK('url', 'name')
  const match = str.match(/^=HYPERLINK\s*\(\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']\s*\)/i);
  if (match) {
    return {
      url: match[1].trim(),
      name: match[2].trim()
    };
  }

  // Nếu chỉ là URL
  if (str.startsWith('http://') || str.startsWith('https://')) {
    return {
      url: str,
      name: str
    };
  }

  // Nếu là chuỗi thông thường không có link
  return {
    url: '',
    name: str
  };
}

/**
 * Tạo công thức HYPERLINK an toàn
 */
export function buildHyperlinkFormula(name, url) {
  const safeName = String(name || '').replace(/"/g, '""');
  const safeUrl = String(url || '').replace(/"/g, '""');
  if (!safeUrl) return safeName;
  return `=HYPERLINK("${safeUrl}", "${safeName}")`;
}

/**
 * Chuẩn hoá số tiền sang number
 */
export function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const cleaned = String(val).replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num);
}
