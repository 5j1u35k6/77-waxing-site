// Conservative extraction: only labelled values enter the review form.
export function recordFields(text) {
  const source = String(text || "").replace(/\r/g, "").replace(/(?:^|[\s|｜;；])((?:顧客姓名|客戶姓名|姓名|手機號碼|行動電話|手機|電話|生日|出生日期|出生年月日|電子信箱|信箱|e-?mail|服務項目|預約服務|服務))\s*[:：]/gi,"\n$1：");
  const find = (pattern) => source.match(pattern)?.[1]?.trim() || "";
  const birthday = find(/(?:生日|出生日期|出生年月日)\s*[:：]?\s*((?:民國\s*)?\d{1,4}\s*[年/.-]\s*\d{1,2}\s*[月/.-]\s*\d{1,2}日?)/);
  const date = birthday.match(/(\d{1,4})\s*[年/.-]\s*(\d{1,2})\s*[月/.-]\s*(\d{1,2})/);
  let normalized = "";
  if (date) {
    const year = Number(date[1]) + (birthday.includes("民國") || date[1].length < 4 ? 1911 : 0);
    const month = Number(date[2]), day = Number(date[3]);
    const value = new Date(Date.UTC(year, month - 1, day));
    if (value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day && year >= 1900 && value <= new Date()) normalized = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  return {
    name: find(/(?:顧客姓名|客戶姓名|姓名)\s*[:：]?\s*([^\n:：]{1,40})/),
    phone: find(/(?:手機號碼|行動電話|手機|電話)\s*[:：]?\s*(\+?\d[\d ()-]{5,25}\d)/).replace(/[ ()-]/g,""),
    birthday: normalized,
    email: find(/(?:電子信箱|信箱|e-?mail)\s*[:：]?\s*([^\s<>]+@[^\s<>]+\.[^\s<>]+)/i),
    service: find(/(?:服務項目|預約服務|服務)\s*[:：]?\s*([^\n]{1,120})/),
    note: ""
  };
}
