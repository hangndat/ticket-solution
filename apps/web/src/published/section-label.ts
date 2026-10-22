/** Product chrome labels for published section kinds (not tenant-authored titles). */
export function publishedSectionKindLabel(kind: string): string {
  switch (kind) {
    case 'info':
      return 'Thông tin';
    case 'guide':
      return 'Hướng dẫn';
    case 'faq':
      return 'Câu hỏi thường gặp';
    default:
      return 'Chi tiết';
  }
}
