function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const action = e.parameter.action;
  
  // Handle getCounts request
  if (action === 'getCounts') {
    const data = sheet.getDataRange().getValues();
    const counts = {};
    
    // Skip header row, iterate through data
    for (let i = 1; i < data.length; i++) {
      const pmid = data[i][0]; // Column A
      const count = data[i][1]; // Column B
      if (pmid) {
        counts[pmid] = count || 0;
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify(counts))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Handle like/unlike action
  const pmid = e.parameter.pmid;
  const timestamp = e.parameter.timestamp;
  const type = e.parameter.type; // 'like' or 'unlike'
  const delta = parseInt(e.parameter.delta) || 0; // Should be 1 or -1
  
  if (!pmid || !action || action !== 'click') {
    return ContentService.createTextOutput('Missing or invalid parameters');
  }
  
  // Determine the delta based on type or use the provided delta
  let countDelta = delta;
  if (type === 'unlike' && countDelta > 0) {
    countDelta = -1;
  } else if (type === 'like' && countDelta < 0) {
    countDelta = 1;
  }
  
  // If no valid delta, default based on type
  if (countDelta === 0) {
    countDelta = (type === 'unlike') ? -1 : 1;
  }
  
  // Search for existing PMID
  const data = sheet.getDataRange().getValues();
  let found = false;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == pmid) {
      // PMID exists, update count with delta
      const currentCount = parseInt(data[i][1]) || 0;
      const newCount = Math.max(0, currentCount + countDelta); // Don't allow negative counts
      sheet.getRange(i + 1, 2).setValue(newCount);
      sheet.getRange(i + 1, 3).setValue(timestamp);
      found = true;
      break;
    }
  }
  
  if (!found) {
    // PMID not found, add new row
    // Only add if it's a like (delta > 0), not an unlike on non-existent entry
    if (countDelta > 0) {
      sheet.appendRow([pmid, countDelta, timestamp, timestamp]);
    }
  }
  
  return ContentService.createTextOutput('Success');
}
