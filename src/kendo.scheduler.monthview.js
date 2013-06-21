kendo_module({
    id: "scheduler.monthview",
    name: "Scheduler Month View",
    category: "web",
    description: "The Scheduler Month View",
    depends: [ "scheduler.view" ]
});

(function($){
    var kendo = window.kendo,
        ui = kendo.ui,
        SchedulerView = ui.SchedulerView,
        NS = ".kendoMonthView",
        extend = $.extend,
        proxy = $.proxy,
        getDate = kendo.date.getDate,
        MS_PER_DAY = kendo.date.MS_PER_DAY,
        DAY_TEMPLATE = kendo.template('<span class="k-link k-nav-day">#=kendo.toString(date, "dd")#</span>'),
        EVENT_WRAPPER_STRING = '<div class="k-event" data-#=ns#uid="#=uid#"' +
                '#if (resources[0]) { #' +
                'style="background-color:#=resources[0].color #"' +
                '#}#' +
                '>' +
                '<span class="k-event-actions">' +
                    '# if(data.tail || data.middle) {#' +
                        '<span class="k-icon k-i-arrow-w"></span>' +
                    '#}#' +
                    '# if(data.recurrenceRule || data.recurrenceId) {#' +
                        '<a href="\\#" class="k-link"><span class="k-icon k-i-refresh"></span></a>' +
                    '#}#' +
                '</span>' +
                '{0}' +
                '<span class="k-event-actions">' +
                    '#if (showDelete) {#' +
                        '<a href="\\#" class="k-link k-event-delete"><span class="k-icon k-i-close"></span></a>' +
                    '#}#' +
                    '# if(data.head || data.middle) {#' +
                        '<span class="k-icon k-i-arrow-e"></span>' +
                    '#}#' +
                '</span>' +
                '</div>',
        EVENT_TEMPLATE = kendo.template('<div title="#=title#">' +
                    '<dl><dd>${title}</dd></dl>' +
                '</div>');

    ui.MonthView = SchedulerView.extend({
        init: function(element, options) {
            var that = this;

            SchedulerView.fn.init.call(that, element, options);

            that.title = that.name = that.options.title;

            that._templates();

            that._editable();

            that._renderLayout(that.options.date);
        },

        _templates: function() {
            var options = this.options,
                settings = extend({}, kendo.Template, options.templateSettings);

            this.eventTemplate = this._eventTmpl(options.eventTemplate);
            this.dayTemplate = kendo.template(options.dayTemplate, settings);
        },

        dateForTitle: function() {
            return kendo.format(this.options.selectedDateFormat, this._firstDayOfMonth, this._lastDayOfMonth);
        },

        nextDate: function() {
            return kendo.date.nextDay(this._lastDayOfMonth);
        },

        previousDate: function() {
            return kendo.date.previousDay(this._firstDayOfMonth);
        },

        startDate: function() {
            return this._startDate;
        },

        endDate: function() {
            return this._endDate;
        },

        _renderLayout: function(date) {
            var that = this;

            this._firstDayOfMonth = kendo.date.firstDayOfMonth(date);

            this._lastDayOfMonth = kendo.date.lastDayOfMonth(date);

            this._startDate = firstVisibleMonthDay(date);

            this.createLayout(this._layout());

            this.table.addClass("k-scheduler-monthview");

            this._content();

            this.refreshLayout();

            this.content.on("click" + NS, ".k-nav-day", function(e) {
               var cell = $(e.currentTarget).closest("td");
               that.trigger("navigate", { view: "day", date: that._rangeToDates(cell).start });
            });

            this.content.on("click" + NS, ".k-more-events", function(e) {
               var index = SchedulerView.rangeIndex($(e.currentTarget)).start,
                   date = kendo.date.addDays(that.startDate(), index);

               that.trigger("navigate", { view: "day", date: date });
            });
        },

        _editable: function() {
            var that = this;
            if (that.options.editable) {

                that.element.on("click" + NS, ".k-scheduler-monthview .k-event a:has(.k-i-close)", function(e) {
                    that.trigger("remove", { uid: $(this).closest(".k-event").attr(kendo.attr("uid")) });
                    e.preventDefault();
                });

                if (that.options.editable.create !== false) {
                    that.element.on("dblclick" + NS, ".k-scheduler-monthview .k-scheduler-content td", function(e) {
                        var element = $(this);
                        that.trigger("add", { eventInfo: extend({ isAllDay: true }, that._rangeToDates(element)) });
                        e.preventDefault();
                    });
                }

                if (that.options.editable.update !== false) {
                    that.element.on("dblclick" + NS, ".k-scheduler-monthview .k-event", function(e) {
                        that.trigger("edit", { uid: $(this).closest(".k-event").attr(kendo.attr("uid")) });
                        e.preventDefault();
                    });
                }
            }
        },

        _rangeToDates: function(cell) {
            var index = this.content.find("table td").index(cell),
                slotDate = kendo.date.addDays(this.startDate(), index);

            if (slotDate) {
                 return {
                    start: slotDate,
                    end: new Date(slotDate)
                };
            }
            return null;
        },

        _content: function() {
            var start = this.startDate(),
                min = this._firstDayOfMonth,
                max = this._lastDayOfMonth,
                idx = 0,
                length = 42,
                cellsPerRow = 7,
                content = this.dayTemplate,
                classes = "",
                slotIndices = {},
                weekStartDates = [start],
                html = '<tbody><tr>';


            for(; idx < length; idx++) {
                if (idx > 0 && idx % cellsPerRow === 0) {
                    weekStartDates.push(start);

                    html += '</tr><tr>';
                }

                classes = "";

                if (kendo.date.isToday(start)) {
                    classes += "k-today";
                }

                if (!kendo.date.isInDateRange(start, min, max)) {
                    classes += " k-other-month";
                }

                html += "<td ";

                if (classes !== "") {
                    html += 'class="' + classes + '"';
                }

                html += ">";
                html += content({ date: start });
                html += "</td>";

                slotIndices[getDate(start).getTime()] = idx;

                start = kendo.date.nextDay(start);
            }

            html += "</tr></tbody>";

            this._slotIndices = slotIndices;
            this._weekStartDates = weekStartDates;
            this._endDate = kendo.date.previousDay(start);
            this.content.find("table").html(html);
        },

        _layout: function() {
            var names = getCalendarInfo().days.names;

            return {
                columns: $.map(names, function(value) { return { text: value }; })
            };
        },

        _eventTmpl: function(template) {
           var options = this.options,
               settings = extend({}, kendo.Template, options.templateSettings),
               paramName = settings.paramName,
               html = "",
               type = typeof template,
               state = { storage: {}, count: 0 };

            if (type === "function") {
                state.storage["tmpl" + state.count] = template;
                html += "#=this.tmpl" + state.count + "(" + paramName + ")#";
                state.count ++;
            } else if (type === "string") {
                html += template;
            }

            var tmpl = kendo.template(kendo.format(EVENT_WRAPPER_STRING, html), settings);

            if (state.count > 0) {
                tmpl = proxy(tmpl, state.storage);
            }
            return tmpl;
       },

       _createEventElement: function(event, template) {
            var options = this.options,
                showDelete = options.editable && options.editable.destroy !== false;

            return $(template(extend({}, {
                ns: kendo.ns,
                showDelete: showDelete,
                resources: this.eventResources(event)
            }, event)));
        },

        _isInDateSlot: function(event) {
            var slotStart = this.startDate(),
                slotEnd = new Date(this.endDate().getTime() + MS_PER_DAY - 1);

            return isInDateRange(event.start, slotStart, slotEnd) ||
                isInDateRange(event.end, slotStart, slotEnd) ||
                isInDateRange(slotStart, event.start, event.end) ||
                isInDateRange(slotEnd, event.start, event.end);
        },

        _slotIndex: function(date) {
            return this._slotIndices[getDate(date).getTime()];
        },

        _calculateAllDayEventWidth: function(startIndex, endIndex) {
            var slots = this.content.find("table td"),
                result = 0,
                widthFunction = startIndex !== endIndex ? "outerWidth" : "innerWidth",
                idx,
                length;

            for (idx = 0, length = slots.length; idx < length; idx++) {
                if (idx >= startIndex && idx <= endIndex) {
                    result += slots.eq(idx)[widthFunction]();
                }
            }
            return result;
        },

        _positionEvent: function(element, startIndex, endIndex) {
            if (startIndex < 0) {
                startIndex = 0;
            }

            if (endIndex < 0 || !endIndex) {
                endIndex = this.content.find("td").length - 1;
            }

            var startSlot = this.content.find("td").eq(startIndex),
                firstChild = startSlot.children().first(),
                events = SchedulerView.collidingHorizontallyEvents(this.content.find(".k-event"), startIndex, endIndex).add(element),
                eventHeight = this.options.eventHeight,
                leftOffset = 2,
                rightOffset = startIndex !== endIndex ? 5 : 4,
                eventWidth = this._calculateAllDayEventWidth(startIndex, endIndex) - rightOffset,
                topOffset = (firstChild.length ? firstChild.outerHeight() : 0) + 3,
                maxColumnCount = Math.floor((startSlot.height() - topOffset) / (eventHeight + 3)),
                top = startSlot.position().top + topOffset + this.content[0].scrollTop,
                left = startSlot.position().left + leftOffset,
                rows;

            element
                .css({
                    width: eventWidth,
                    left: left,
                    height: eventHeight
                });

            element.attr(kendo.attr("start-end-idx"), startIndex + "-" + endIndex);

            rows = SchedulerView.createRows(events);

            for (var idx = 0, length = Math.min(rows.length, maxColumnCount); idx < length; idx++) {
                var rowEvents = rows[idx].events;

                for (var j = 0, eventLength = rowEvents.length; j < eventLength; j++) {
                    $(rowEvents[j]).css({
                        top: top + idx * eventHeight + 3*idx
                    });
                }
            }

            if (rows.length > maxColumnCount) {
                this.content.find(kendo.format(".k-more-events[{0}={1}-{2}]", kendo.attr("start-end-idx"), startIndex, endIndex)).remove();

                element = $('<div class="k-more-events k-button"><span>...</span></div>')
                    .attr(kendo.attr("start-end-idx"), startIndex + "-" + endIndex)
                    .css({
                        width: startSlot.innerWidth() - 2,
                        left: left,
                        top: top + maxColumnCount * eventHeight + 3*maxColumnCount
                    });
            }

            element.appendTo(this.content);
        },

        _splitEvents: function(events) {
            var result = [],
                idx,
                event,
                weekStartDates = this._weekStartDates,
                eventDurationInDays,
                weekStart,
                length;

            for (idx = 0, length = events.length; idx < length; idx++) {
                event = extend({}, events[idx]);

                for (var dateIdx = 0, dateLength = weekStartDates.length; dateIdx < dateLength; dateIdx++) {
                    weekStart = weekStartDates[dateIdx];
                    eventDurationInDays = Math.ceil((event.end - event.start) / MS_PER_DAY);

                    if (isInDateRange(weekStart, event.start, event.end) && eventDurationInDays >= 1) {
                        if (getDate(event.start).getTime() === getDate(weekStart).getTime()) {
                            if (eventDurationInDays > 1) {
                                if (event.tail) {
                                    event.tail = false;
                                    event.middle = true;
                                } else {
                                    event.head = true;
                                }
                            }
                        } else {
                            var tmp = extend({}, event);

                            if (event.tail) {
                                event.tail = false;
                                tmp.middle = true;
                            } else {
                                tmp.head = true;
                            }

                            tmp.start = event.start;
                            tmp.end = kendo.date.previousDay(weekStart);
                            result.push(tmp);

                            event.start = weekStart;
                            event.head = false;

                            if (getDate(event.end).getTime() > getDate(this.endDate()).getTime() + MS_PER_DAY - 1) {
                                event.middle = true;
                            } else {
                                event.tail = true;
                            }
                            event.end = event.end;
                        }
                    }
                }

                result.push(event);
            }

            return result;
        },

        render: function(events) {
            var event,
                eventTemplate = this.eventTemplate,
                idx,
                length;

            this.content.find(".k-event, .k-more-events").remove();

            events = new kendo.data.Query(this._splitEvents(events)).sort([{ field: "start", dir: "asc" },{ field: "end", dir: "desc" }]).toArray();

            for (idx = 0, length = events.length; idx < length; idx++) {
                event = events[idx];

                if (this._isInDateSlot(event)) {
                    var startSlotIndex = this._slotIndex(event.start),
                        endSlotIndex = this._slotIndex(event.end),
                        element = this._createEventElement(event, eventTemplate);

                    if (startSlotIndex === -1 && endSlotIndex > -1) {
                        startSlotIndex = endSlotIndex;
                    }

                    this._positionEvent(element, startSlotIndex, endSlotIndex);

                }
            }
        },

        destroy: function(){
            if (this.table) {
                this.table.removeClass("k-scheduler-monthview");
            }

            if (this.content) {
                this.content.off(NS);
            }

            if (this.element) {
                this.element.off(NS);
            }

            SchedulerView.fn.destroy.call(this);
        },

        events: ["remove", "add", "edit", "navigate"],

        options: {
            title: "Month",
            name: "month",
            eventHeight: 25,
            editable: true,
            selectedDateFormat: "{0:y}",
            dayTemplate: DAY_TEMPLATE,
            eventTemplate: EVENT_TEMPLATE
        }
    });

    function getCalendarInfo() {
        return kendo.culture().calendars.standard;
    }

    function firstVisibleMonthDay(date) {
        var calendarInfo = getCalendarInfo();

        var firstDay = calendarInfo.firstDay,
            firstVisibleDay = new Date(date.getFullYear(), date.getMonth(), 0, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());

        while (firstVisibleDay.getDay() != firstDay) {
            kendo.date.setTime(firstVisibleDay, -1 * MS_PER_DAY);
        }

        return firstVisibleDay;
    }

    function isInDateRange(value, min, max) {
        var msMin = min.getTime(),
            msMax = max.getTime(),
            msValue;

        msValue = value.getTime();

        return msValue >= msMin && msValue <= msMax;
    }

})(window.kendo.jQuery);
