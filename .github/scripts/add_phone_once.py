from pathlib import Path

js_path = Path("assets/booking-core.js")
js = js_path.read_text()

anchor = 'const blockMinutesFor = (durationMinutes) => (Math.floor(Number(durationMinutes || 90) / 30) + 1) * 30;\n'
insert = r'''
const PHONE_COUNTRIES = [
  { name: "Australia", dial: "+61", lengths: [10], trunk: "0" },
  { name: "Austria", dial: "+43", lengths: [10, 11], trunk: "0" },
  { name: "Bangladesh", dial: "+880", lengths: [11], trunk: "0" },
  { name: "Belgium", dial: "+32", lengths: [10], trunk: "0" },
  { name: "Brazil", dial: "+55", lengths: [11], trunk: "" },
  { name: "Cambodia", dial: "+855", lengths: [9, 10], trunk: "0" },
  { name: "Canada", dial: "+1", lengths: [10], trunk: "" },
  { name: "China", dial: "+86", lengths: [11], trunk: "" },
  { name: "Denmark", dial: "+45", lengths: [8], trunk: "" },
  { name: "Finland", dial: "+358", lengths: [10], trunk: "0" },
  { name: "France", dial: "+33", lengths: [10], trunk: "0" },
  { name: "Germany", dial: "+49", lengths: [10, 11], trunk: "0" },
  { name: "Hong Kong", dial: "+852", lengths: [8], trunk: "" },
  { name: "India", dial: "+91", lengths: [10], trunk: "" },
  { name: "Indonesia", dial: "+62", lengths: [10, 11, 12, 13], trunk: "0" },
  { name: "Ireland", dial: "+353", lengths: [10], trunk: "0" },
  { name: "Italy", dial: "+39", lengths: [10], trunk: "" },
  { name: "Japan", dial: "+81", lengths: [11], trunk: "0" },
  { name: "Macau", dial: "+853", lengths: [8], trunk: "" },
  { name: "Malaysia", dial: "+60", lengths: [10, 11], trunk: "0" },
  { name: "Mexico", dial: "+52", lengths: [10], trunk: "" },
  { name: "Myanmar", dial: "+95", lengths: [9, 10], trunk: "0" },
  { name: "Netherlands", dial: "+31", lengths: [10], trunk: "0" },
  { name: "New Zealand", dial: "+64", lengths: [9, 10], trunk: "0" },
  { name: "Norway", dial: "+47", lengths: [8], trunk: "" },
  { name: "Philippines", dial: "+63", lengths: [11], trunk: "0" },
  { name: "Poland", dial: "+48", lengths: [9], trunk: "" },
  { name: "Portugal", dial: "+351", lengths: [9], trunk: "" },
  { name: "Qatar", dial: "+974", lengths: [8], trunk: "" },
  { name: "Saudi Arabia", dial: "+966", lengths: [10], trunk: "0" },
  { name: "Singapore", dial: "+65", lengths: [8], trunk: "" },
  { name: "South Africa", dial: "+27", lengths: [10], trunk: "0" },
  { name: "South Korea", dial: "+82", lengths: [10, 11], trunk: "0" },
  { name: "Spain", dial: "+34", lengths: [9], trunk: "" },
  { name: "Sweden", dial: "+46", lengths: [10], trunk: "0" },
  { name: "Switzerland", dial: "+41", lengths: [10], trunk: "0" },
  { name: "Taiwan", dial: "+886", lengths: [10], trunk: "0" },
  { name: "Thailand", dial: "+66", lengths: [10], trunk: "0" },
  { name: "United Arab Emirates", dial: "+971", lengths: [10], trunk: "0" },
  { name: "United Kingdom", dial: "+44", lengths: [11], trunk: "0" },
  { name: "United States", dial: "+1", lengths: [10], trunk: "" },
  { name: "Vietnam", dial: "+84", lengths: [10], trunk: "0" },
].sort((a, b) => a.name.localeCompare(b.name, "en"));

const phoneCountryOptions = () => PHONE_COUNTRIES.map((country) => `<option value="${esc(country.name)}" ${country.name === "Taiwan" ? "selected" : ""}>${esc(country.name)} (${esc(country.dial)})</option>`).join("");
const phoneCountryFor = (name) => PHONE_COUNTRIES.find((country) => country.name === name) || PHONE_COUNTRIES.find((country) => country.name === "Taiwan");
const phoneRuleText = (country) => `${country.name} (${country.dial})｜手機號碼需 ${country.lengths.join(" 或 ")} 碼`;
const phoneState = (root) => {
  const select = root.querySelector('[name="phoneCountry"]');
  const input = root.querySelector('[name="phone"]');
  const country = phoneCountryFor(select?.value || "Taiwan");
  const local = String(input?.value || "").replace(/\D/g, "");
  const valid = country.lengths.includes(local.length);
  let national = local;
  if (country.trunk && national.startsWith(country.trunk)) national = national.slice(country.trunk.length);
  const international = `${country.dial}${national}`;
  return { country, local, valid, international };
};
'''
if "const PHONE_COUNTRIES =" not in js:
    if anchor not in js:
        raise SystemExit("phone insert anchor missing")
    js = js.replace(anchor, anchor + "\n" + insert, 1)

old_markup = '<label>手機<input name="phone" inputmode="tel" autocomplete="tel"></label>'
new_markup = '<label class="phone-label">手機<div class="phone-composite"><select name="phoneCountry" aria-label="國際冠碼">${phoneCountryOptions()}</select><input name="phone" inputmode="numeric" autocomplete="tel-national" pattern="[0-9]*" aria-describedby="phone-rule"></div><small class="phone-rule" id="phone-rule" data-phone-rule></small></label>'
if old_markup in js:
    js = js.replace(old_markup, new_markup, 1)
elif 'name="phoneCountry"' not in js:
    raise SystemExit("phone markup anchor missing")

prefill_anchor = "  const prefillNote = root.querySelector('[data-booking-prefill-note]');\n"
phone_setup = r'''
  const phoneCountrySelect = root.querySelector('[name="phoneCountry"]');
  const phoneInput = root.querySelector('[name="phone"]');
  const phoneRule = root.querySelector('[data-phone-rule]');
  const syncPhoneField = () => {
    const country = phoneCountryFor(phoneCountrySelect?.value || "Taiwan");
    const maxLength = Math.max(...country.lengths);
    if (phoneInput) {
      phoneInput.maxLength = maxLength;
      const digits = String(phoneInput.value || "").replace(/\D/g, "").slice(0, maxLength);
      if (phoneInput.value !== digits) phoneInput.value = digits;
      phoneInput.placeholder = country.lengths.length === 1 ? `${country.lengths[0]} digits` : `${Math.min(...country.lengths)}–${maxLength} digits`;
    }
    const state = phoneState(root);
    if (phoneRule) {
      phoneRule.textContent = state.local && !state.valid ? `${phoneRuleText(country)}（目前 ${state.local.length} 碼）` : phoneRuleText(country);
      phoneRule.dataset.state = state.local && !state.valid ? "invalid" : "";
    }
    phoneInput?.setCustomValidity(state.local && !state.valid ? phoneRuleText(country) : "");
  };
  phoneCountrySelect?.addEventListener("change", syncPhoneField);
  phoneInput?.addEventListener("input", syncPhoneField);
  phoneInput?.addEventListener("blur", syncPhoneField);
  syncPhoneField();
'''
if "const syncPhoneField = () =>" not in js:
    if prefill_anchor not in js:
        raise SystemExit("phone setup anchor missing")
    js = js.replace(prefill_anchor, prefill_anchor + phone_setup, 1)

old_validate = '''        const phone = root.querySelector('[name="phone"]').value.trim();
        const email = root.querySelector('[name="email"]').value.trim();
        const accepted = root.querySelector('[name="ok"]').checked;
        if (!name || !phone || !email || !accepted) return alert("請填寫姓名、手機、Email 並勾選同意。");
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return alert("請確認 Email 格式。");
        const endTime = addMinutesToTime(selectedTime, selectedItem.durationMinutes);
        const summary = { 服務分類: selectedCategory.name, 服務項目: selectedItem.name, 施作時間: selectedItem.durationLabel, 日期: selectedDate, 開始時間: selectedTime, 結束時間: `${endTime}（${selectedItem.durationLabel}）`, 姓名: name, 手機: phone, Email: email, 來店: root.querySelector('[name="first"]').value === "yes" ? "第一次" : "回訪" };
'''
new_validate = '''        const phone = phoneState(root);
        const email = root.querySelector('[name="email"]').value.trim();
        const accepted = root.querySelector('[name="ok"]').checked;
        if (!name || !phone.local || !email || !accepted) return alert("請填寫姓名、手機、Email 並勾選同意。");
        if (!phone.valid) { syncPhoneField(); phoneInput?.focus(); return alert(phoneRuleText(phone.country)); }
        if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return alert("請確認 Email 格式。");
        const endTime = addMinutesToTime(selectedTime, selectedItem.durationMinutes);
        const summary = { 服務分類: selectedCategory.name, 服務項目: selectedItem.name, 施作時間: selectedItem.durationLabel, 日期: selectedDate, 開始時間: selectedTime, 結束時間: `${endTime}（${selectedItem.durationLabel}）`, 姓名: name, 手機: `${phone.country.name} (${phone.country.dial}) ${phone.local}`, Email: email, 來店: root.querySelector('[name="first"]').value === "yes" ? "第一次" : "回訪" };
'''
if old_validate in js:
    js = js.replace(old_validate, new_validate, 1)
elif 'const phone = phoneState(root);' not in js:
    raise SystemExit("phone validation anchor missing")

old_submit = '''      const name = root.querySelector('[name="name"]').value.trim();
      const phone = root.querySelector('[name="phone"]').value.replace(/[\\s()-]/g, "").trim();
      const email = root.querySelector('[name="email"]').value.trim().toLowerCase();
'''
new_submit = '''      const name = root.querySelector('[name="name"]').value.trim();
      const phone = phoneState(root);
      if (!phone.valid) { syncPhoneField(); show(3); phoneInput?.focus(); throw new Error("INVALID_PHONE"); }
      const email = root.querySelector('[name="email"]').value.trim().toLowerCase();
'''
if old_submit in js:
    js = js.replace(old_submit, new_submit, 1)
elif 'throw new Error("INVALID_PHONE")' not in js:
    raise SystemExit("phone submit anchor missing")

old_record = 'customerName: name, customerPhone: phone, customerEmail: email,'
new_record = 'customerName: name, customerPhone: phone.local, customerPhoneCountry: phone.country.name, customerPhoneDialCode: phone.country.dial, customerPhoneInternational: phone.international, customerEmail: email,'
if old_record in js:
    js = js.replace(old_record, new_record, 1)
elif 'customerPhoneInternational: phone.international' not in js:
    raise SystemExit("phone Firestore anchor missing")

old_catch = '''      if (error instanceof Error && error.message === "SLOT_CONFLICT") {
        alert("這個時段剛被其他預約保留，請重新選擇。");
'''
new_catch = '''      if (error instanceof Error && error.message === "INVALID_PHONE") {
        alert(phoneRuleText(phoneState(root).country));
      } else if (error instanceof Error && error.message === "SLOT_CONFLICT") {
        alert("這個時段剛被其他預約保留，請重新選擇。");
'''
if old_catch in js:
    js = js.replace(old_catch, new_catch, 1)
elif 'error.message === "INVALID_PHONE"' not in js:
    raise SystemExit("phone catch anchor missing")

js_path.write_text(js)

css_path = Path("assets/booking-core.css")
css = css_path.read_text()
css_block = r'''
/* International mobile number input: country selector is visually part of the same field. */
.phone-label{min-width:0}.phone-composite{display:grid;grid-template-columns:minmax(145px,42%) minmax(0,1fr);align-items:stretch;border:1px solid #3a383620;border-radius:10px;background:#fff;overflow:hidden;transition:border-color .15s ease,box-shadow .15s ease}.phone-composite:focus-within{border-color:#c5a070;box-shadow:0 0 0 3px #c5a07018}.phone-composite select,.phone-composite input{min-width:0;width:100%;height:46px;margin:0;border:0!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;outline:0;padding:10px 11px}.phone-composite select{border-right:1px solid #3a383618!important;color:#3a3836;font-size:13px;font-weight:650;text-overflow:ellipsis}.phone-composite input{font-variant-numeric:tabular-nums;letter-spacing:.035em}.phone-rule{display:block;min-height:18px;color:#7d705d;font-size:11px;font-weight:500;line-height:1.45}.phone-rule[data-state="invalid"]{color:#9b4438}@media(max-width:560px){.phone-composite{grid-template-columns:minmax(132px,45%) minmax(0,1fr)}.phone-composite select,.phone-composite input{height:45px;padding:9px 10px}.phone-composite select{font-size:12px}.phone-rule{font-size:10px}}
'''
if ".phone-composite{" not in css:
    css += "\n\n" + css_block
css_path.write_text(css)

html_path = Path("booking/index.html")
html = html_path.read_text()
html = html.replace("booking-core.css?v=20260909-2108", "booking-core.css?v=20260911-1132")
html = html.replace("booking-core.js?v=20260910-0832", "booking-core.js?v=20260911-1132")
html_path.write_text(html)

state_path = Path("PROJECT_STATE.md")
state = state_path.read_text()
state_anchor = "- 服務頁與價目頁不得先顯示舊資料再覆蓋；首次無快取時只顯示中性載入狀態。\n"
state_line = "- 預約聯絡資料的手機欄位使用「英文國名 + 國際冠碼」選單（A→Z，預設 Taiwan +886）與本地號碼同框顯示；依國家嚴格限制允許位數，Taiwan 必須 10 碼、Japan 必須 11 碼。Firestore 保留本地號碼並另外儲存國家、冠碼與完整國際格式。\n"
if state_line not in state:
    if state_anchor not in state:
        raise SystemExit("project state anchor missing")
    state = state.replace(state_anchor, state_anchor + state_line, 1)
state_path.write_text(state)
