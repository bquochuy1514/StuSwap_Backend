// src/common/utils/string.utils.ts

/**
 * Bỏ dấu tiếng Việt và chuẩn hóa chuỗi
 * @param str - Chuỗi cần chuẩn hóa
 * @returns Chuỗi đã bỏ dấu, lowercase, trim
 * @example
 * removeVietnameseTones('Điện thoại Samsung') // => 'dien thoai samsung'
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';

  return str
    .normalize('NFD') // Tách dấu ra khỏi chữ cái
    .replace(/[\u0300-\u036f]/g, '') // Xóa các dấu thanh
    .replace(/đ/g, 'd') // đ -> d
    .replace(/Đ/g, 'D') // Đ -> D
    .toLowerCase()
    .trim();
}

/**
 * Chuẩn hóa nhiều khoảng trắng thành 1
 */
export function normalizeSpaces(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}
