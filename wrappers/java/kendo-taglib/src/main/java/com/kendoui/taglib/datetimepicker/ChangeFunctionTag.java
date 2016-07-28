
package com.kendoui.taglib.datetimepicker;

import com.kendoui.taglib.FunctionTag;

import com.kendoui.taglib.DateTimePickerTag;


import javax.servlet.jsp.JspException;

@SuppressWarnings("serial")
public class ChangeFunctionTag extends FunctionTag /* interfaces *//* interfaces */ {
    
    @Override
    public int doEndTag() throws JspException {
//>> doEndTag


        DateTimePickerTag parent = (DateTimePickerTag)findParentWithClass(DateTimePickerTag.class);


        parent.setChange(this);

//<< doEndTag

        return super.doEndTag();
    }

    @Override
    public void initialize() {
//>> initialize
//<< initialize

        super.initialize();
    }

    @Override
    public void destroy() {
//>> destroy
//<< destroy

        super.destroy();
    }

//>> Attributes

    public static String tagName() {
        return "dateTimePicker-change";
    }

//<< Attributes

}