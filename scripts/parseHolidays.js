const fs = require('fs');
const path = require('path');

const csvFilePath = path.join(__dirname, '../hebcal_2026_eur.csv');
const jsonFilePath = path.join(__dirname, '../client/src/data/holidays.json');

const csvContent = fs.readFileSync(csvFilePath, 'utf8');

const lines = csvContent.split('\n');
const headers = lines[0].split(',');

const holidaysMap = {};

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Extremely simple CSV parser assuming fields are surrounded by quotes and separated by commas.
  // We only need Subject and Start Date.
  // The line might have commas inside quotes, so we should be careful.
  const regex = /"([^"]*)"/g;
  let matches = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
    matches.push(match[1]);
  }
  
  if (matches.length < 2) continue;
  
  const subject = matches[0];
  const startDateStr = matches[1];
  
  // parse D/M/YYYY or DD/MM/YYYY
  const parts = startDateStr.split('/');
  if (parts.length === 3) {
    let day = parts[0];
    let month = parts[1];
    let year = parts[2];
    
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}`;
    
    if (holidaysMap[formattedDate]) {
      holidaysMap[formattedDate] += ' / ' + subject;
    } else {
      holidaysMap[formattedDate] = subject;
    }
  }
}

// Create dir if not exists
const dir = path.dirname(jsonFilePath);
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(jsonFilePath, JSON.stringify(holidaysMap, null, 2), 'utf8');
console.log('Successfully generated holidays.json');
