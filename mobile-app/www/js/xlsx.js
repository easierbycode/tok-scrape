// Minimal in-browser .xlsx reader. Single sheet, header-row + data rows.
//
// Why hand-rolled instead of SheetJS: the only xlsx we ingest is the TikTok
// Shop affiliate "exported data" workbook. It is a normal ZIP container with
// one sheet, all-string cells (`t="str"` inline), and a 47-column header row;
// SheetJS would add ~900KB to the APK to handle features we do not need.
//
// What we do support:
//   - Stored (compression method 0) and deflate (method 8) ZIP entries.
//   - sharedStrings.xml lookups (`t="s"`), inline strings (`t="str"` /
//     `t="inlineStr"`), and untyped numeric cells.
//   - The first <sheet> in the workbook.
//
// What we do NOT support:
//   - Encrypted xlsx, ZIP64, or split archives.
//   - Date serials or other typed values — every cell is returned as a string.
//
// Returned shape:
//   { sheetName, headers: [string, ...], rows: [{ [header]: string }, ...] }

(function (global) {
  'use strict';

  // ---- ZIP reader ------------------------------------------------------

  // ZIP central directory record signature: "PK\x01\x02".
  var CDH_SIG = 0x02014b50;
  // End-of-central-directory record signature: "PK\x05\x06".
  var EOCD_SIG = 0x06054b50;

  function readU16(buf, off) { return buf[off] | (buf[off + 1] << 8); }
  function readU32(buf, off) {
    // >>> 0 keeps the result unsigned even when the high bit is set.
    return ((buf[off]) | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
  }

  // Walk backwards from EOF looking for the EOCD signature; the comment field
  // can push it up to ~64KB before EOF, but in practice it sits at -22.
  function findEOCD(buf) {
    var maxBack = Math.min(buf.length - 22, 65557);
    for (var i = buf.length - 22; i >= buf.length - 22 - maxBack && i >= 0; i--) {
      if (readU32(buf, i) === EOCD_SIG) return i;
    }
    throw new Error('xlsx: end-of-central-directory record not found');
  }

  function parseCentralDirectory(buf) {
    var eocd = findEOCD(buf);
    var entryCount = readU16(buf, eocd + 10);
    var cdOff      = readU32(buf, eocd + 16);
    var entries = [];
    var p = cdOff;
    for (var i = 0; i < entryCount; i++) {
      if (readU32(buf, p) !== CDH_SIG) throw new Error('xlsx: corrupt central directory at entry ' + i);
      var method   = readU16(buf, p + 10);
      var compSize = readU32(buf, p + 20);
      var uncSize  = readU32(buf, p + 24);
      var nameLen  = readU16(buf, p + 28);
      var extraLen = readU16(buf, p + 30);
      var commLen  = readU16(buf, p + 32);
      var localOff = readU32(buf, p + 42);
      var name = utf8Decode(buf.subarray(p + 46, p + 46 + nameLen));
      entries.push({ name: name, method: method, compSize: compSize, uncSize: uncSize, localOff: localOff });
      p += 46 + nameLen + extraLen + commLen;
    }
    return entries;
  }

  // Local file header: skip past variable-length name + extra to land on the
  // payload. compSize/method are duplicated here but we trust the central dir.
  // DecompressionStream understands deflate-raw (no zlib wrapper), which is
  // exactly what ZIP method 8 stores. Available in modern Chrome WebViews.
  async function inflateRawAsync(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('xlsx: DecompressionStream not available; cannot read deflate ZIP entries');
    }
    var ds = new DecompressionStream('deflate-raw');
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    var reader = stream.getReader();
    var chunks = [];
    var total = 0;
    while (true) {
      var step = await reader.read();
      if (step.done) break;
      chunks.push(step.value);
      total += step.value.length;
    }
    var out = new Uint8Array(total);
    var off = 0;
    for (var i = 0; i < chunks.length; i++) { out.set(chunks[i], off); off += chunks[i].length; }
    return out;
  }

  async function readEntry(buf, entry) {
    var p = entry.localOff;
    var nameLen  = readU16(buf, p + 26);
    var extraLen = readU16(buf, p + 28);
    var dataOff  = p + 30 + nameLen + extraLen;
    var slice    = buf.subarray(dataOff, dataOff + entry.compSize);
    if (entry.method === 0) return slice;
    if (entry.method === 8) return await inflateRawAsync(slice);
    throw new Error('xlsx: unsupported compression method ' + entry.method + ' for ' + entry.name);
  }

  function utf8Decode(bytes) {
    if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }

  // ---- Worksheet XML parser -------------------------------------------

  function parseSharedStrings(xmlText) {
    if (!xmlText) return [];
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    var nodes = doc.getElementsByTagName('si');
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      // <si> can wrap a single <t> or a series of <r><t>...</t></r> runs.
      var ts = nodes[i].getElementsByTagName('t');
      var s = '';
      for (var j = 0; j < ts.length; j++) s += ts[j].textContent || '';
      out.push(s);
    }
    return out;
  }

  // "A1" -> 0, "B1" -> 1, "AA1" -> 26.
  function colIndexFromRef(ref) {
    var m = /^([A-Z]+)\d+$/.exec(ref || '');
    if (!m) return -1;
    var letters = m[1];
    var n = 0;
    for (var i = 0; i < letters.length; i++) {
      n = n * 26 + (letters.charCodeAt(i) - 64);
    }
    return n - 1;
  }

  function cellValue(cellEl, sharedStrings) {
    var t = cellEl.getAttribute('t') || '';
    if (t === 'inlineStr') {
      var is = cellEl.getElementsByTagName('is')[0];
      if (!is) return '';
      var ts = is.getElementsByTagName('t');
      var s = '';
      for (var j = 0; j < ts.length; j++) s += ts[j].textContent || '';
      return s;
    }
    var v = cellEl.getElementsByTagName('v')[0];
    var raw = v ? (v.textContent || '') : '';
    if (t === 's') {
      var idx = parseInt(raw, 10);
      return (idx >= 0 && idx < sharedStrings.length) ? sharedStrings[idx] : '';
    }
    // 'str', 'b', 'n', '' (number) — all returned as the raw textual value.
    return raw;
  }

  function parseSheet(xmlText, sharedStrings) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    var rowEls = doc.getElementsByTagName('row');
    var rows = [];
    for (var i = 0; i < rowEls.length; i++) {
      var cellEls = rowEls[i].getElementsByTagName('c');
      var row = [];
      for (var j = 0; j < cellEls.length; j++) {
        var ref = cellEls[j].getAttribute('r') || '';
        var col = colIndexFromRef(ref);
        if (col < 0) continue;
        // Pad with empty strings so we honor sparse columns positionally.
        while (row.length < col) row.push('');
        row.push(cellValue(cellEls[j], sharedStrings));
      }
      rows.push(row);
    }
    return rows;
  }

  // ---- Public entry point ---------------------------------------------

  // Resolve the first <sheet>'s target rId via xl/workbook.xml.rels — we don't
  // try to handle multi-sheet workbooks because the export has exactly one.
  function findSheetPath(entries) {
    var byName = Object.create(null);
    for (var i = 0; i < entries.length; i++) byName[entries[i].name] = entries[i];
    if (byName['xl/worksheets/sheet1.xml']) return 'xl/worksheets/sheet1.xml';
    for (var name in byName) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) return name;
    }
    return null;
  }

  async function parseXlsx(arrayBuffer) {
    var buf = new Uint8Array(arrayBuffer);
    var entries = parseCentralDirectory(buf);
    var byName = Object.create(null);
    for (var i = 0; i < entries.length; i++) byName[entries[i].name] = entries[i];

    var sharedStrings = [];
    if (byName['xl/sharedStrings.xml']) {
      var ssBytes = await readEntry(buf, byName['xl/sharedStrings.xml']);
      sharedStrings = parseSharedStrings(utf8Decode(ssBytes));
    }

    var sheetPath = findSheetPath(entries);
    if (!sheetPath) throw new Error('xlsx: no worksheet found in workbook');
    var sheetBytes = await readEntry(buf, byName[sheetPath]);
    var rawRows = parseSheet(utf8Decode(sheetBytes), sharedStrings);

    if (!rawRows.length) return { sheetName: sheetPath, headers: [], rows: [] };
    var headers = rawRows[0].map(function (h) { return String(h || '').trim(); });
    var rows = [];
    for (var r = 1; r < rawRows.length; r++) {
      var row = rawRows[r];
      // Skip rows that are entirely empty (TikTok adds none, but be safe).
      var any = false;
      for (var c = 0; c < row.length; c++) if (row[c] !== '' && row[c] != null) { any = true; break; }
      if (!any) continue;
      var obj = Object.create(null);
      for (var k = 0; k < headers.length; k++) {
        if (!headers[k]) continue;
        obj[headers[k]] = row[k] != null ? row[k] : '';
      }
      rows.push(obj);
    }
    return { sheetName: sheetPath, headers: headers, rows: rows };
  }

  global.XlsxReader = { parse: parseXlsx };
})(window);
