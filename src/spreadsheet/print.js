(function(f, define){
    define([ "../kendo.pdf", "./sheet", "./range", "./references", "./numformat", "../util/text-metrics" ], f);
})(function(){
    "use strict";

    if (kendo.support.browser.msie && kendo.support.browser.version < 9) {
        return;
    }

    var spreadsheet = kendo.spreadsheet;
    var CellRef = spreadsheet.CellRef;
    var drawing = kendo.drawing;
    var formatting = spreadsheet.formatting;
    var geo = kendo.geometry;

    var GUIDELINE_WIDTH = 0.8;

    /* jshint eqnull:true, laxbreak:true, shadow:true, -W054 */
    /* jshint latedef: nofunc */

    // This takes a list of row heights and the page height, and
    // produces a list of Y coordinates for each row, such that rows
    // are not truncated across pages.  However, the algorithm will
    // decide to truncate a row in the event that more than 0.2 of the
    // available space would otherwise be left blank.
    //
    // It will be used for horizontal splitting too (will receive
    // column widths and page width, and produce a list of X coords).
    function distributeCoords(heights, pageHeight) {
        var curr = 0;
        var out = [];
        var threshold = 0.2 * pageHeight;
        var bottom = pageHeight;
        heights.forEach(function(h){
            if (pageHeight && curr + h > bottom) {
                if (bottom - curr < threshold) {
                    // align to next page
                    curr = pageHeight * Math.ceil(curr / pageHeight);
                }
                // update bottom anyway; don't just add pageHeight, as
                // we might need multiple pages for the pathological
                // case of one row higher than the page.
                bottom += pageHeight * Math.ceil(h / pageHeight);
            }
            out.push(curr);
            curr += h;
        });
        out.push(curr);
        return out;
    }

    function getMergedCells(sheet, range) {
        var grid = sheet._grid;
        var primary = {};
        var secondary = {};

        sheet.forEachMergedCell(range, function(ref) {
            var topLeft = ref.topLeft;
            grid.forEach(ref, function(cellRef) {
                if (topLeft.eq(cellRef)) {
                    primary[cellRef.print()] = ref;
                } else if (range.contains(cellRef)) {
                    secondary[cellRef.print()] = topLeft;
                }
            });
        });

        return { primary: primary, secondary: secondary };
    }

    function doLayout(sheet, range, options) {
        // 1. obtain the list of cells that need to be printed, the
        //    row heights and column widths.  Place in each cell row,
        //    col (relative to range, i.e. first is 0,0), rowspan,
        //    colspan and merged.
        var cells = [];
        var rowHeights = [];
        var colWidths = [];
        var mergedCells = getMergedCells(sheet, range);
        var maxRow = -1, maxCol = -1;
        sheet.forEach(range, function(row, col, cell){
            var relrow = row - range.topLeft.row;
            var relcol = col - range.topLeft.col;
            var rh = sheet.rowHeight(row);
            var cw = sheet.columnWidth(col);
            if (!relcol) {
                rowHeights.push(rh);
            }
            if (!relrow) {
                colWidths.push(cw);
            }
            if (sheet.isHiddenColumn(col) || sheet.isHiddenRow(row) || !rh || !cw) {
                return;
            }
            var nonEmpty = options.forScreen || shouldDrawCell(cell);
            if (!(options.emptyCells || nonEmpty)) {
                return;
            }
            var id = new CellRef(row, col).print();
            if (mergedCells.secondary[id]) {
                return;
            }
            if (nonEmpty) {
                maxRow = Math.max(maxRow, relrow);
                maxCol = Math.max(maxCol, relcol);
            } else {
                cell.empty = true;
            }
            var m = mergedCells.primary[id];
            if (m) {
                delete mergedCells.primary[id];
                cell.merged = true;
                cell.rowspan = m.height();
                cell.colspan = m.width();
                if (options.forScreen) {
                    cell.width = sheet._columns.sum(m.topLeft.col, m.bottomRight.col);
                    cell.height = sheet._rows.sum(m.topLeft.row, m.bottomRight.row);
                }
            } else {
                cell.rowspan = 1;
                cell.colspan = 1;
            }
            cell.row = relrow;
            cell.col = relcol;
            cells.push(cell);
        });

        // keep only the drawable area
        rowHeights = rowHeights.slice(0, maxRow + 1);
        colWidths = colWidths.slice(0, maxCol + 1);

        var pageWidth = options.pageWidth;
        var pageHeight = options.pageHeight;
        var scaleFactor = 1;

        // when fitWidth is requested, we must update the page size
        // with the corresponding scale factor; the algorithm below
        // (2) will continue to work, just drwaing on a bigger page.
        if (options.fitWidth) {
            var width = colWidths.reduce(sum, 0);
            if (width > pageWidth) {
                scaleFactor = pageWidth / width;
                pageWidth /= scaleFactor;
                pageHeight /= scaleFactor;
            }
        }

        // 2. calculate top, left, bottom, right, width and height for
        //    printable cells.  Merged cells will be split across
        //    pages, unless the first row/col is shifted to next page.
        //    boxWidth and boxHeight get the complete drawing size.
        //    Note that cell coordinates keep increasing, i.e. they
        //    are not reset to zero for a new page (in fact, we don't
        //    even care about page dimensions here).  The print
        //    function translates the view to current page.
        var yCoords = distributeCoords(rowHeights, pageHeight || 0);
        var xCoords = distributeCoords(colWidths, pageWidth || 0);
        var boxWidth = 0;
        var boxHeight = 0;
        cells = cells.filter(function(cell){
            if (cell.empty && (cell.row > maxRow || cell.col > maxCol)) {
                return false;
            }
            cell.left = xCoords[cell.col];
            cell.top = yCoords[cell.row];
            if (cell.merged) {
                if (!options.forScreen) {
                    cell.right = orlast(xCoords, cell.col + cell.colspan);
                    cell.bottom = orlast(yCoords, cell.row + cell.rowspan);
                    cell.width = cell.right - cell.left;
                    cell.height = cell.bottom - cell.top;
                } else {
                    cell.right = cell.left + cell.width;
                    cell.bottom = cell.top + cell.height;
                }
            } else {
                cell.width = colWidths[cell.col];
                cell.height = rowHeights[cell.row];
                cell.bottom = cell.top + cell.height;
                cell.right = cell.left + cell.width;
            }
            boxWidth = Math.max(boxWidth, cell.right);
            boxHeight = Math.max(boxHeight, cell.bottom);
            return true;
        });

        // 3. if any merged cells remain in "primary", they start
        //    outside the printed range and we should still display
        //    them partially.
        Object.keys(mergedCells.primary).forEach(function(id){
            var ref = mergedCells.primary[id];
            sheet.forEach(ref.topLeft.toRangeRef(), function(row, col, cell){
                var relrow = row - range.topLeft.row;
                var relcol = col - range.topLeft.col;
                cell.merged = true;
                cell.colspan = ref.height();
                cell.rowspan = ref.width();
                if (relrow < 0) {
                    cell.top = -sheet._rows.sum(row, row - relrow - 1);
                } else {
                    cell.top = yCoords[relrow];
                }
                if (relcol < 0) {
                    cell.left = -sheet._columns.sum(col, col - relcol - 1);
                } else {
                    cell.left = xCoords[relcol];
                }
                cell.height = sheet._rows.sum(ref.topLeft.row, ref.bottomRight.row);
                cell.width = sheet._columns.sum(ref.topLeft.col, ref.bottomRight.col);
                if (cell.height > 0 && cell.width > 0) {
                    // zero means a fully hidden merged cell (all rows/columns are hidden)
                    // https://github.com/telerik/kendo-ui-core/issues/1794
                    cell.right = cell.left + cell.width;
                    cell.bottom = cell.top + cell.height;
                    cells.push(cell);
                }
            });
        });

        return {
            width  : boxWidth,
            height : boxHeight,
            cells  : cells.sort(normalOrder),
            scale  : scaleFactor,
            xCoords: xCoords,
            yCoords: yCoords
        };
    }

    function sum(a, b) {
        return a + b;
    }

    function orlast(a, i) {
        return i < a.length ? a[i] : a[a.length - 1];
    }

    function shouldDrawCell(cell) {
        return cell.value != null
            || cell.merged
            || cell.background != null
            || cell.borderTop != null
            || cell.borderRight != null
            || cell.borderBottom != null
            || cell.borderLeft != null
            || (cell.validation != null && !cell.validation.value);
    }

    function normalOrder(a, b) {
        if (a.top < b.top) {
            return -1;
        } else if (a.top == b.top) {
            if (a.left < b.left) {
                return -1;
            } else if (a.left == b.left) {
                return 0;
            } else {
                return 1;
            }
        } else {
            return 1;
        }
    }

    function drawLayout(layout, group, options) {
        // options:
        // - pageWidth
        // - pageHeight
        // - fitWidth
        // - hCenter
        // - vCenter
        var ncols = Math.ceil(layout.width / options.pageWidth);
        var nrows = Math.ceil(layout.height / options.pageHeight);
        var pageWidth = options.pageWidth / layout.scale;
        var pageHeight = options.pageHeight / layout.scale;

        for (var i = 0; i < ncols; ++i) {
            for (var j = 0; j < nrows; ++j) {
                addPage(j, i);
            }
        }

        function addPage(row, col) {
            var left = col * pageWidth;
            var right = left + pageWidth;
            var top = row * pageHeight;
            var bottom = top + pageHeight;
            var endbottom = 0, endright = 0;

            // XXX: this can be optimized - discard cells that won't
            // be used again, and don't walk cells that stand no
            // chance to fit.
            var cells = layout.cells.filter(function(cell){
                if (cell.right <= left || cell.left >= right ||
                    cell.bottom <= top || cell.top >= bottom) {
                    return false;
                }
                endbottom = Math.max(cell.bottom, endbottom);
                endright = Math.max(cell.right, endright);
                return true;
            });

            if (cells.length > 0) {
                var page = new drawing.Group();
                group.append(page);
                page.clip(drawing.Path.fromRect(
                    new geo.Rect([ 0, 0 ],
                                 [ options.pageWidth, options.pageHeight ])));

                var content = new drawing.Group();
                page.append(content);

                var matrix = geo.Matrix.scale(layout.scale, layout.scale)
                    .multiplyCopy(geo.Matrix.translate(-left, -top));

                if (options.hCenter || options.vCenter) {
                    matrix = matrix.multiplyCopy(
                        geo.Matrix.translate(
                            options.hCenter ? (right - endright) / 2 : 0,
                            options.vCenter ? (bottom - endbottom) / 2 : 0)
                    );
                }

                content.transform(matrix);

                if (options.guidelines) {
                    var prev = null;
                    layout.xCoords.forEach(function(x){
                        x = Math.min(x, endright);
                        if (x !== prev && x >= left && x <= right) {
                            prev = x;
                            content.append(
                                new drawing.Path()
                                    .moveTo(x, top)
                                    .lineTo(x, endbottom)
                                    .close()
                                    .stroke("#999", GUIDELINE_WIDTH)
                            );
                        }
                    });
                    var prev = null;
                    layout.yCoords.forEach(function(y){
                        y = Math.min(y, endbottom);
                        if (y !== prev && y >= top && y <= bottom) {
                            prev = y;
                            content.append(
                                new drawing.Path()
                                    .moveTo(left, y)
                                    .lineTo(endright, y)
                                    .close()
                                    .stroke("#999", GUIDELINE_WIDTH)
                            );
                        }
                    });
                }

                var borders = new drawing.Group();
                cells.forEach(function(cell){
                    drawCell(cell, content, borders, options);
                });
                content.append(borders);
            }
        }
    }

    function drawCell(cell, content, borders, options) {
        var g = new drawing.Group();
        content.append(g);
        var rect = new geo.Rect([ cell.left, cell.top ],
                                [ cell.width, cell.height ]);
        if (cell.background || cell.merged) {
            var r2d2 = rect;
            if (options.guidelines) {
                r2d2 = rect.clone();
                r2d2.origin.x += GUIDELINE_WIDTH/2;
                r2d2.origin.y += GUIDELINE_WIDTH/2;
                r2d2.size.width -= GUIDELINE_WIDTH;
                r2d2.size.height -= GUIDELINE_WIDTH;
            }
            g.append(
                new drawing.Rect(r2d2)
                    .fill(cell.background || "#fff")
                    .stroke(null)
            );
        }
        if (cell.borderLeft) {
            borders.append(
                new drawing.Path()
                    .moveTo(cell.left, cell.top)
                    .lineTo(cell.left, cell.bottom)
                    .close()
                    .stroke(cell.borderLeft.color, cell.borderLeft.size)
            );
        }
        if (cell.borderTop) {
            borders.append(
                new drawing.Path()
                    .moveTo(cell.left, cell.top)
                    .lineTo(cell.right, cell.top)
                    .close()
                    .stroke(cell.borderTop.color, cell.borderTop.size)
            );
        }
        if (cell.borderRight) {
            borders.append(
                new drawing.Path()
                    .moveTo(cell.right, cell.top)
                    .lineTo(cell.right, cell.bottom)
                    .close()
                    .stroke(cell.borderRight.color, cell.borderRight.size)
            );
        }
        if (cell.borderBottom) {
            borders.append(
                new drawing.Path()
                    .moveTo(cell.left, cell.bottom)
                    .lineTo(cell.right, cell.bottom)
                    .close()
                    .stroke(cell.borderBottom.color, cell.borderBottom.size)
            );
        }
        var val = cell.value;
        if (val != null) {
            var type = typeof val == "number" ? "number" : null;
            var clip = new drawing.Group();
            clip.clip(drawing.Path.fromRect(rect));
            g.append(clip);
            var f;
            if (cell.format) {
                f = formatting.textAndColor(val, cell.format);
                val = f.text;
                if (f.type) {
                    type = f.type;
                }
            } else {
                val += "";
            }
            if (!cell.textAlign) {
                switch (type) {
                  case "number":
                  case "date":
                  case "percent":
                    cell.textAlign = "right";
                    break;
                  case "boolean":
                    cell.textAlign = "center";
                    break;
                }
            }
            drawText(val, (f && f.color) || cell.color || "#000", cell, clip);
        }
    }

    function drawText(text, color, cell, group) {
        // XXX: account for border and padding below.  depends on CSS.
        var rect_left   = cell.left   + 2;
        var rect_top    = cell.top    + 2;
        var rect_width  = cell.width  - 4;
        var rect_height = cell.height - 4;
        var font = makeFontDef(cell);
        var style = { font: font };
        var props = {
            font: font,
            fill: { color: color }
        };
        var lines = [], text_height = 0, top = rect_top;
        if (cell.wrap) {
            lineBreak(text, style, rect_width).forEach(function(line){
                var tmp = new drawing.Text(line.text, [ rect_left, top ], props);
                top += line.box.height;
                lines.push({ el: tmp, box: line.box });
            });
            text_height = top - rect_top;
        } else {
            var tmp = new drawing.Text(text, [ rect_left, top ], props);
            var box = kendo.util.measureText(text, style);
            lines.push({ el: tmp, box: box });
            text_height = box.height;
        }
        var cont = new drawing.Group();
        group.append(cont);
        var vtrans = 0;
        switch (cell.verticalAlign) {
          case "center":
            vtrans = (rect_height - text_height) >> 1;
            break;

          case undefined:
          case null:
          case "bottom":
            vtrans = (rect_height - text_height);
            break;
        }
        if (vtrans < 0) { vtrans = 0; }
        lines.forEach(function(line){
            cont.append(line.el);
            var htrans = 0;
            switch (cell.textAlign) {
              case "center":
                htrans = (rect_width - line.box.width) >> 1;
                break;
              case "right":
                htrans = rect_width - line.box.width;
                break;
            }
            if (htrans < 0) { htrans = 0; }
            if (htrans || vtrans) {
                line.el.transform(geo.Matrix.translate(htrans, vtrans));
            }
        });
    }

    function lineBreak(text, style, width) {
        var lines = [];
        var len = text.length;
        var start = 0;
        while (start < len) {
            split(start, len, len);
        }
        return lines;
        function split(min, eol, max) {
            var sub = text.substring(start, eol).trim();
            var box = kendo.util.measureText(sub, style);
            if (box.width <= width) {
                if (eol < max-1) {
                    split(eol, (eol+max)>>1, max);
                } else {
                    lines.push({ text: sub, box: box });
                    start = eol;
                }
            } else if (min < eol) {
                split(min, (min + eol) >> 1, eol);
            }
        }
    }

    function makeFontDef(cell) {
        var font = [];
        if (cell.italic) {
            font.push("italic");
        }
        if (cell.bold) {
            font.push("bold");
        }
        font.push((cell.fontSize || 12) + "px");
        font.push((cell.fontFamily || "Arial"));
        return font.join(" ");
    }

    function draw(sheet, range, options, callback) {
        if (options == null && callback == null) {
            callback = range;
            options = {};
            range = spreadsheet.SHEETREF;
        }
        if (callback == null) {
            callback = options;
            if (range instanceof spreadsheet.Range
                || range instanceof spreadsheet.Ref
                || typeof range == "string") {
                options = {};
            } else {
                options = range;
                range = spreadsheet.SHEETREF;
            }
        }
        options = kendo.jQuery.extend({
            paperSize  : "A4",
            landscape  : true,
            margin     : "1cm",
            guidelines : true,
            emptyCells : true,
            fitWidth   : false,
            center     : false
        }, options);
        var group = new drawing.Group();
        var paper = kendo.pdf.getPaperOptions(options);
        group.options.set("pdf", {
            author    : options.author,
            creator   : options.creator,
            date      : options.date,
            keywords  : options.keywords,
            margin    : paper.margin,
            multiPage : true,
            paperSize : paper.paperSize,
            subject   : options.subject,
            title     : options.title
        });
        var pageWidth = paper.paperSize[0];
        var pageHeight = paper.paperSize[1];
        if (paper.margin) {
            pageWidth -= paper.margin.left + paper.margin.right;
            pageHeight -= paper.margin.top + paper.margin.bottom;
        }
        options.pageWidth = pageWidth;
        options.pageHeight = pageHeight;
        var layout = doLayout(sheet, sheet._ref(range), options);
        drawLayout(layout, group, options);
        callback(group);
    }

    spreadsheet.Sheet.prototype.draw = function(range, options, callback) {
        var sheet = this;
        if (sheet._workbook) {
            sheet.recalc(sheet._workbook._context, function(){
                draw(sheet, range, options, callback);
            });
        } else {
            draw(sheet, range, options, callback);
        }
    };

    spreadsheet.draw = {
        doLayout       : doLayout,
        drawLayout     : drawLayout,
        shouldDrawCell : shouldDrawCell
    };

}, typeof define == 'function' && define.amd ? define : function(a1, a2, a3){ (a3 || a2)(); });