<%@ Page Title="" Language="C#" MasterPageFile="~/Areas/aspx/Views/Shared/Web.Master" Inherits="System.Web.Mvc.ViewPage<dynamic>" %>

<asp:Content ContentPlaceHolderID="HeadContent" runat="server">
</asp:Content>

<asp:Content ContentPlaceHolderID="MainContent" runat="server">
<%
    var continents = new List<SelectListItem> {
        new SelectListItem() {
            Text = "Africa", Value = "1"
        },
        new SelectListItem() {
            Text = "Europe", Value = "2"
        },
        new SelectListItem() {
            Text = "Asia", Value = "3"
        },
        new SelectListItem() {
            Text = "North America", Value = "4"
        },
        new SelectListItem() {
            Text = "South America", Value = "5"
        },
        new SelectListItem() {
            Text = "Antarctica", Value = "6"
        },
        new SelectListItem() {
            Text = "Australia", Value = "7"
        }
    };
%>

<div class="demo-section k-content">
    <h4>Select Continents</h4>
    <%= Html.Kendo().MultiSelect()
            .Name("select")
            .DataTextField("Text")
            .DataValueField("Value")
            .BindTo(continents)
            .Events(e =>
            {
                e.Change("onChange").Select("onSelect").Deselect("onDeselect").Open("onOpen").Close("onClose").DataBound("onDataBound").Filtering("onFiltering");
            })
    %>
</div>

<script>
    function onOpen() {
        kendoConsole.log("event: open");
    }

    function onClose() {
        kendoConsole.log("event: close");
    }

    function onChange() {
        kendoConsole.log("event: change");
    }

    function onDataBound() {
        kendoConsole.log("event: dataBound");
    }

    function onFiltering() {
        kendoConsole.log("event: filtering");
    }

    function onSelect(e) {
        if ("kendoConsole" in window) {
            var dataItem = e.dataItem;
            kendoConsole.log("event :: select (" + dataItem.Text + " : " + dataItem.Value + ")");
        }
    }

    function onDeselect(e) {
        if ("kendoConsole" in window) {
            var dataItem = e.dataItem;
            kendoConsole.log("event :: deselect (" + dataItem.Text + " : " + dataItem.Value + ")");
        }
    }
</script>
<div class="box">
    <h4>Console log</h4>
    <div class="console"></div>
</div>
</asp:Content>