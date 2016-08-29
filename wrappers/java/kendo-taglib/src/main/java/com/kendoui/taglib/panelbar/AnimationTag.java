
package com.kendoui.taglib.panelbar;

import com.kendoui.taglib.BaseTag;

import com.kendoui.taglib.PanelBarTag;




import javax.servlet.jsp.JspException;

@SuppressWarnings("serial")
public class AnimationTag extends BaseTag /* interfaces *//* interfaces */ {
    
    @Override
    public int doEndTag() throws JspException {
//>> doEndTag


        PanelBarTag parent = (PanelBarTag)findParentWithClass(PanelBarTag.class);


        parent.setAnimation(this);

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
        return "panelBar-animation";
    }

    public void setCollapse(com.kendoui.taglib.panelbar.AnimationCollapseTag value) {
        setProperty("collapse", value);
    }

    public void setExpand(com.kendoui.taglib.panelbar.AnimationExpandTag value) {
        setProperty("expand", value);
    }

//<< Attributes

}