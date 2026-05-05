export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('vi-VN').format(date);
};
