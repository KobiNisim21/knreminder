const fs = require('fs');
const path = require('path');

const jlemCsvPath = path.join(__dirname, '../candles-jerusalem-2026.csv');
const holonCsvPath = path.join(__dirname, '../candles-holon-2026.csv');
const outPath = path.join(__dirname, '../client/src/data/shabbat.json');

const jlemData = fs.readFileSync(jlemCsvPath, 'utf8').split('\n').filter(Boolean);
const holonData = fs.readFileSync(holonCsvPath, 'utf8').split('\n').filter(Boolean);

// Skip header
const jlemLines = jlemData.slice(1);
const holonLines = holonData.slice(1);

const holonMap = {};
holonLines.forEach(line => {
  const [date, parsha, candles, havdalah] = line.split(',');
  if (date) {
    holonMap[date] = { candles: candles?.trim(), havdalah: havdalah?.trim() };
  }
});

const shabbatMap = {};

jlemLines.forEach(line => {
  const [dateStr, parsha, candles, havdalah] = line.split(',');
  if (!dateStr) return;

  const jlemCandles = candles?.trim();
  const jlemHavdalah = havdalah?.trim();
  
  const hData = holonMap[dateStr] || {};
  const holonCandles = hData.candles || '';
  const holonHavdalah = hData.havdalah || '';

  // Friday is the date in the CSV
  shabbatMap[dateStr] = {
    parsha: `פרשת ${parsha}`,
    type: 'friday',
    displayText: `פרשת ${parsha} | הדלקת נרות: ירושלים ${jlemCandles} • חולון ${holonCandles}`
  };

  // Saturday is date + 1 day
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  const satDateStr = d.toISOString().split('T')[0];

  shabbatMap[satDateStr] = {
    parsha: `פרשת ${parsha}`,
    type: 'saturday',
    displayText: `פרשת ${parsha} | יציאת שבת: ירושלים ${jlemHavdalah} • חולון ${holonHavdalah}`
  };
});

fs.writeFileSync(outPath, JSON.stringify(shabbatMap, null, 2), 'utf8');
console.log('Successfully generated shabbat.json');
