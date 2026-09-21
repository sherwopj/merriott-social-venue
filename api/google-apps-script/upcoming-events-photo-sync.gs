/**
 * Paste this into the "Upcoming events" Google Sheet's Apps Script editor
 * (Extensions > Apps Script), then add an installable trigger:
 *   Triggers (clock icon) > Add Trigger
 *     Function: onFormSubmit
 *     Event source: From spreadsheet
 *     Event type: On form submit
 *
 * What it does: when the Form's optional "Photo" file-upload question is
 * answered, Forms drops a private Drive link into column I. That link isn't
 * usable as an <img> src on the website until the file is shared publicly
 * and rewritten as a direct-view URL — this trigger does exactly that, and
 * writes the result into column J, which is the column the website reads.
 *
 * Column layout (row 1 = Form's header row):
 *   B=Event date  C=End date  D=Title  E=Description  F=Category
 *   G=Ticketed?  H=Details TBC?  I=Photo (raw, from Forms)  J=Photo direct URL
 */
function onFormSubmit(e) {
  try {
    const sheet = e.range.getSheet()
    const row = e.range.getRow()
    const rawPhotoCell = sheet.getRange(row, 9).getValue() // column I
    if (!rawPhotoCell) return // no photo uploaded for this entry

    const fileId = extractDriveFileId(String(rawPhotoCell))
    if (!fileId) {
      Logger.log('Row %s: could not find a Drive file ID in "%s"', row, rawPhotoCell)
      return
    }

    const file = DriveApp.getFileById(fileId)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

    const directUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000'
    sheet.getRange(row, 10).setValue(directUrl) // column J
  } catch (err) {
    Logger.log('onFormSubmit failed: %s', err)
  }
}

function extractDriveFileId(text) {
  const match = text.match(/[-\w]{25,}/)
  return match ? match[0] : null
}
